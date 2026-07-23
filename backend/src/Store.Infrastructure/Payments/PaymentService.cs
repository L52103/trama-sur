using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.EntityFrameworkCore;
using Store.Application.Payments;
using Store.Domain.Catalog;
using Store.Domain.Commerce;
using Store.Domain.Common;
using Store.Domain.Operations;
using Store.Infrastructure.Persistence;

namespace Store.Infrastructure.Payments;

internal sealed class PaymentService(StoreDbContext db, IWebpayGateway gateway, IDataProtectionProvider dataProtectionProvider) : IPaymentService
{
    private readonly IDataProtector _protector = dataProtectionProvider.CreateProtector("Store.Webpay.Token.v1");

    public async Task<PaymentRedirectDto> CreateWebpayAsync(CreatePaymentRequest request, CancellationToken cancellationToken)
    {
        var order = await db.Orders.SingleOrDefaultAsync(x => x.Id == request.OrderId, cancellationToken)
            ?? throw new KeyNotFoundException("Pedido no encontrado.");
        if (order.Status is not OrderStatus.PendingPayment) throw new DomainException("El pedido no está disponible para pago.");

        var existing = await db.PaymentTransactions.SingleOrDefaultAsync(x => x.IdempotencyKey == request.IdempotencyKey, cancellationToken)
            ?? await db.PaymentTransactions
                .Where(x => x.OrderId == request.OrderId && (x.Status == PaymentStatus.Created || x.Status == PaymentStatus.Redirected))
                .OrderByDescending(x => x.CreatedAt)
                .FirstOrDefaultAsync(cancellationToken);
        PaymentTransaction payment;
        if (existing is not null)
        {
            if (existing.OrderId != request.OrderId) throw new DomainException("La clave de idempotencia pertenece a otro pedido.");
            if (existing.Status == PaymentStatus.Redirected)
                return new PaymentRedirectDto(existing.Id, _protector.Unprotect(existing.ProviderTokenProtected), new Uri(existing.RedirectUrl), existing.AmountClp);
            if (existing.Status != PaymentStatus.Created) throw new DomainException("La solicitud de pago ya fue procesada.");
            payment = existing;
        }
        else
        {
            payment = new PaymentTransaction(order.Id, request.IdempotencyKey, order.TotalClp);
            db.PaymentTransactions.Add(payment);
            await db.SaveChangesAsync(cancellationToken);
        }

        var result = await gateway.CreateAsync(order.Number, payment.Id.ToString("N"), order.TotalClp, cancellationToken);
        payment.MarkRedirected(payment.Id.ToString("N"), Hash(result.Token), _protector.Protect(result.Token), result.Url.ToString(), DateTimeOffset.UtcNow);
        await db.SaveChangesAsync(cancellationToken);
        return new PaymentRedirectDto(payment.Id, result.Token, result.Url, payment.AmountClp);
    }

    public async Task<PaymentResultDto> CommitWebpayAsync(string token, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(token) || token.Length > 200) throw new DomainException("Token de pago inválido.");
        var tokenHash = Hash(token);
        var snapshot = await db.PaymentTransactions.AsNoTracking().SingleOrDefaultAsync(x => x.ProviderTokenHash == tokenHash, cancellationToken)
            ?? throw new KeyNotFoundException("Transacción no encontrada.");
        if (snapshot.Status == PaymentStatus.Authorized)
        {
            var paidOrder = await db.Orders.AsNoTracking().SingleAsync(x => x.Id == snapshot.OrderId, cancellationToken);
            return Success(paidOrder);
        }

        var provider = await gateway.CommitAsync(token, cancellationToken);

        await using var transaction = await db.Database.BeginTransactionAsync(cancellationToken);
        var payment = await db.PaymentTransactions.FromSqlInterpolated($"SELECT * FROM payment_transactions WHERE id = {snapshot.Id} FOR UPDATE").SingleAsync(cancellationToken);
        var order = await db.Orders.FromSqlInterpolated($"SELECT * FROM orders WHERE id = {payment.OrderId} FOR UPDATE").SingleAsync(cancellationToken);
        if (payment.Status == PaymentStatus.Authorized) return Success(order);

        var safeAudit = JsonSerializer.Serialize(new { provider.Status, provider.ResponseCode, provider.Amount, provider.AuthorizationCode, provider.BuyOrder, provider.TransactionDate });
        var authorized = provider.ResponseCode == 0 && provider.Status == "AUTHORIZED" && provider.Amount == order.TotalClp && provider.BuyOrder == order.Number;
        if (!authorized)
        {
            payment.MarkRejected(provider.ResponseCode, safeAudit, DateTimeOffset.UtcNow);
            order.MarkPaymentFailed(DateTimeOffset.UtcNow);
            await ReleaseInventoryAsync(order.Id, cancellationToken);
            await RestoreCartAsync(order.Id, cancellationToken);
            await db.SaveChangesAsync(cancellationToken);
            await transaction.CommitAsync(cancellationToken);
            return new PaymentResultDto(order.Id, order.Number, "Rejected", false, "El pago no fue autorizado. No se realizó ningún cobro confirmado.");
        }

        payment.MarkAuthorized(provider.AuthorizationCode, provider.ResponseCode, safeAudit, DateTimeOffset.UtcNow);
        order.MarkPaid(DateTimeOffset.UtcNow);
        await CommitInventoryAsync(order.Id, cancellationToken);
        var redemption = await db.PromotionRedemptions.SingleOrDefaultAsync(x => x.OrderId == order.Id, cancellationToken);
        redemption?.Commit(DateTimeOffset.UtcNow);
        db.OutboxMessages.Add(new OutboxMessage("OrderPaid", JsonSerializer.Serialize(new { order.Id, order.Number, order.CustomerEmail }), DateTimeOffset.UtcNow));
        await db.SaveChangesAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);
        return Success(order);
    }

    public async Task<PaymentResultDto?> GetStatusAsync(Guid orderId, CancellationToken cancellationToken)
    {
        var order = await db.Orders.AsNoTracking().SingleOrDefaultAsync(x => x.Id == orderId, cancellationToken);
        if (order is null) return null;
        var payment = await db.PaymentTransactions.AsNoTracking().Where(x => x.OrderId == orderId).OrderByDescending(x => x.CreatedAt).FirstOrDefaultAsync(cancellationToken);
        return new PaymentResultDto(order.Id, order.Number, payment?.Status.ToString() ?? "NotStarted", payment?.Status == PaymentStatus.Authorized, payment?.Status == PaymentStatus.Authorized ? "Pago confirmado." : "Pago pendiente o no confirmado.");
    }

    private async Task CommitInventoryAsync(Guid orderId, CancellationToken cancellationToken)
    {
        var reservation = await db.StockReservations.Include(x => x.Items).SingleOrDefaultAsync(x => x.OrderId == orderId, cancellationToken)
            ?? throw new DomainException("No existe una reserva de inventario para el pedido.");
        if (reservation.Status == ReservationStatus.Committed) return;
        if (reservation.Status != ReservationStatus.Active || reservation.ExpiresAt <= DateTimeOffset.UtcNow)
            throw new DomainException("La reserva de inventario venció antes de confirmar el pago.");

        var inventoryIds = reservation.Items.Select(x => x.InventoryItemId).Order().ToArray();
        var inventory = await db.InventoryItems
            .FromSqlInterpolated($"SELECT i.*, i.xmin FROM inventory_items AS i WHERE i.id = ANY({inventoryIds}) ORDER BY i.id FOR UPDATE")
            .ToDictionaryAsync(x => x.Id, cancellationToken);
        foreach (var allocation in reservation.Items.OrderBy(x => x.InventoryItemId))
        {
            var stock = inventory[allocation.InventoryItemId];
            var previous = stock.OnHand;
            stock.Commit(allocation.Quantity, DateTimeOffset.UtcNow);
            db.InventoryMovements.Add(new InventoryMovement(stock.Id, InventoryMovementType.Sale, -allocation.Quantity, previous, stock.OnHand, "Venta confirmada por Webpay", orderId.ToString(), null));
        }
        reservation.Commit(DateTimeOffset.UtcNow);
    }

    private async Task ReleaseInventoryAsync(Guid orderId, CancellationToken cancellationToken)
    {
        var reservation = await db.StockReservations.Include(x => x.Items).SingleOrDefaultAsync(x => x.OrderId == orderId, cancellationToken);
        if (reservation is null || reservation.Status is ReservationStatus.Released or ReservationStatus.Expired) return;
        if (reservation.Status is ReservationStatus.Committed) throw new DomainException("Una reserva confirmada no se puede liberar.");

        var inventoryIds = reservation.Items.Select(x => x.InventoryItemId).Order().ToArray();
        var inventory = await db.InventoryItems
            .FromSqlInterpolated($"SELECT i.*, i.xmin FROM inventory_items AS i WHERE i.id = ANY({inventoryIds}) ORDER BY i.id FOR UPDATE")
            .ToDictionaryAsync(x => x.Id, cancellationToken);
        foreach (var allocation in reservation.Items.OrderBy(x => x.InventoryItemId))
        {
            var stock = inventory[allocation.InventoryItemId];
            stock.Release(allocation.Quantity, DateTimeOffset.UtcNow);
            db.InventoryMovements.Add(new InventoryMovement(stock.Id, InventoryMovementType.ReservationRelease, 0, stock.OnHand, stock.OnHand, "Pago rechazado", orderId.ToString(), null));
        }
        reservation.Release(DateTimeOffset.UtcNow);
        var redemption = await db.PromotionRedemptions.SingleOrDefaultAsync(x => x.OrderId == orderId, cancellationToken);
        redemption?.Release(DateTimeOffset.UtcNow);
    }

    private static PaymentResultDto Success(Order order) => new(order.Id, order.Number, "Authorized", true, "Pago confirmado. Estamos preparando tu pedido.");
    private static string Hash(string value) => Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(value)));

    private async Task RestoreCartAsync(Guid orderId, CancellationToken cancellationToken)
    {
        var order = await db.Orders.Include(x => x.Items).SingleAsync(x => x.Id == orderId, cancellationToken);
        if (!order.SourceCartId.HasValue || await db.CartItems.AnyAsync(x => x.CartId == order.SourceCartId.Value, cancellationToken)) return;
        foreach (var item in order.Items) db.CartItems.Add(new CartItem(order.SourceCartId.Value, item.VariantId, Math.Min(10, item.Quantity)));
    }
}
