using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Store.Domain.Commerce;
using Store.Domain.Common;
using Store.Domain.Operations;
using Store.Infrastructure.Persistence;

namespace Store.Infrastructure.Services;

internal sealed class ReservationExpiryWorker(IServiceScopeFactory scopeFactory, ILogger<ReservationExpiryWorker> logger) : BackgroundService
{
    private static readonly Action<ILogger, int, Exception?> LogExpired = LoggerMessage.Define<int>(LogLevel.Information, new EventId(2101, "ReservationsExpired"), "Expired {Count} inventory reservations");
    private static readonly Action<ILogger, Exception?> LogFailure = LoggerMessage.Define(LogLevel.Error, new EventId(5101, "ReservationExpiryFailure"), "Reservation expiry worker failed");

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        await ExpireBatchSafelyAsync(stoppingToken);
        using var timer = new PeriodicTimer(TimeSpan.FromSeconds(30));
        while (await timer.WaitForNextTickAsync(stoppingToken)) await ExpireBatchSafelyAsync(stoppingToken);
    }

    private async Task ExpireBatchSafelyAsync(CancellationToken cancellationToken)
    {
        try
        {
            var count = await ExpireBatchAsync(cancellationToken);
            if (count > 0) LogExpired(logger, count, null);
        }
        catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested) { }
        catch (Exception exception) { LogFailure(logger, exception); }
    }

    private async Task<int> ExpireBatchAsync(CancellationToken cancellationToken)
    {
        await using var scope = scopeFactory.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<StoreDbContext>();
        await using var transaction = await db.Database.BeginTransactionAsync(cancellationToken);
        var reservations = await db.StockReservations
            .FromSqlRaw("SELECT * FROM stock_reservations WHERE status = 'Active' AND expires_at <= NOW() ORDER BY expires_at FOR UPDATE SKIP LOCKED LIMIT 50")
            .ToListAsync(cancellationToken);
        if (reservations.Count == 0)
        {
            await transaction.CommitAsync(cancellationToken);
            return 0;
        }

        var reservationIds = reservations.Select(x => x.Id).ToArray();
        var items = await db.StockReservationItems.Where(x => reservationIds.Contains(x.StockReservationId)).OrderBy(x => x.InventoryItemId).ToListAsync(cancellationToken);
        var inventoryIds = items.Select(x => x.InventoryItemId).Distinct().Order().ToArray();
        var inventory = await db.InventoryItems
            .FromSqlInterpolated($"SELECT i.*, i.xmin FROM inventory_items AS i WHERE i.id = ANY({inventoryIds}) ORDER BY i.id FOR UPDATE")
            .ToDictionaryAsync(x => x.Id, cancellationToken);
        var orderIds = reservations.Select(x => x.OrderId).Order().ToArray();
        var orders = await db.Orders
            .FromSqlInterpolated($"SELECT * FROM orders WHERE id = ANY({orderIds}) ORDER BY id FOR UPDATE")
            .ToDictionaryAsync(x => x.Id, cancellationToken);
        var orderItems = await db.OrderItems.Where(x => orderIds.Contains(x.OrderId)).ToListAsync(cancellationToken);
        var now = DateTimeOffset.UtcNow;

        foreach (var reservation in reservations)
        {
            foreach (var allocation in items.Where(x => x.StockReservationId == reservation.Id))
            {
                var stock = inventory[allocation.InventoryItemId];
                if (stock.Reserved < allocation.Quantity) throw new DomainException("La reserva expirada no coincide con el inventario reservado.");
                stock.Release(allocation.Quantity, now);
                db.InventoryMovements.Add(new InventoryMovement(stock.Id, InventoryMovementType.ReservationRelease, 0, stock.OnHand, stock.OnHand, "Reserva de pago vencida", reservation.OrderId.ToString(), null));
            }
            reservation.Release(now, expired: true);
            if (orders.TryGetValue(reservation.OrderId, out var order))
            {
                order.MarkExpired(now);
                var redemption = await db.PromotionRedemptions.SingleOrDefaultAsync(x => x.OrderId == order.Id, cancellationToken);
                redemption?.Release(now);
                if (order.SourceCartId.HasValue && !await db.CartItems.AnyAsync(x => x.CartId == order.SourceCartId.Value, cancellationToken))
                    foreach (var item in orderItems.Where(x => x.OrderId == order.Id)) db.CartItems.Add(new CartItem(order.SourceCartId.Value, item.VariantId, Math.Min(10, item.Quantity)));
                db.OutboxMessages.Add(new OutboxMessage("OrderPaymentExpired", System.Text.Json.JsonSerializer.Serialize(new { reservation.OrderId, order.Number, Email = order.CustomerEmail }), now));
            }
        }

        await db.SaveChangesAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);
        return reservations.Count;
    }
}
