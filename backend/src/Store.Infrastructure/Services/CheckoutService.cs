using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Store.Application.Checkout;
using Store.Domain.Catalog;
using Store.Domain.Commerce;
using Store.Domain.Common;
using Store.Domain.Operations;
using Store.Infrastructure.Persistence;

namespace Store.Infrastructure.Services;

internal sealed class CheckoutService(StoreDbContext db) : ICheckoutService
{
    public async Task<CheckoutQuoteDto> QuoteAsync(CheckoutQuoteRequest request, CancellationToken cancellationToken)
    {
        var cart = await LoadCartAsync(request.CartToken, cancellationToken);
        var subtotal = await CalculateSubtotalAsync(cart.Id, cancellationToken);
        var shipping = subtotal >= 79_990 ? 0 : ShippingFor(request.ShippingAddress.Region);
        var code = request.CouponCode ?? cart.CouponCode;
        var promotion = await ActivePromotionAsync(code, cancellationToken);
        var discount = promotion?.CalculateDiscount(subtotal, shipping, DateTimeOffset.UtcNow) ?? 0;
        var applied = new List<string>();
        if (shipping == 0) applied.Add("Despacho gratis desde $79.990");
        if (promotion is not null && discount > 0) applied.Add(promotion.Name);
        return new CheckoutQuoteDto(subtotal, discount, shipping, checked(subtotal - discount + shipping), "CLP", "Despacho estándar", "3 a 6 días hábiles", applied);
    }

    public async Task<CreateOrderDto> CreateOrderAsync(CreateOrderRequest request, CancellationToken cancellationToken)
    {
        if (!request.AcceptedTerms) throw new DomainException("Debes aceptar los términos para continuar.");
        var keyHash = Hash(request.IdempotencyKey);
        var requestHash = Hash(JsonSerializer.Serialize(request));
        var existing = await db.IdempotencyKeys.AsNoTracking().SingleOrDefaultAsync(x => x.Scope == "checkout" && x.KeyHash == keyHash, cancellationToken);
        if (existing is not null)
        {
            if (existing.RequestHash != requestHash) throw new DomainException("La clave de idempotencia fue reutilizada con datos diferentes.");
            if (!string.IsNullOrWhiteSpace(existing.ResponseBody)) return JsonSerializer.Deserialize<CreateOrderDto>(existing.ResponseBody) ?? throw new DomainException("La respuesta idempotente no es válida.");
            throw new DomainException("Esta solicitud todavía se está procesando.");
        }

        await using var transaction = await db.Database.BeginTransactionAsync(cancellationToken);
        var cart = await LoadCartAsync(request.CartToken, cancellationToken);
        var rows = await db.CartItems.Where(x => x.CartId == cart.Id).OrderBy(x => x.VariantId).ToListAsync(cancellationToken);
        if (rows.Count == 0) throw new DomainException("La bolsa está vacía.");

        var variantIds = rows.Select(x => x.VariantId).ToArray();
        var inventory = await db.InventoryItems.FromSqlInterpolated($"SELECT i.*, i.xmin FROM inventory_items AS i WHERE i.variant_id = ANY({variantIds}) ORDER BY i.variant_id, i.warehouse_id FOR UPDATE").ToListAsync(cancellationToken);
        var variants = await db.ProductVariants.Include(x => x.Product).Where(x => variantIds.Contains(x.Id) && x.IsActive).ToDictionaryAsync(x => x.Id, cancellationToken);
        if (variants.Count != variantIds.Distinct().Count()) throw new DomainException("Una variante ya no está disponible.");

        var orderId = Guid.CreateVersion7();
        var orderItems = new List<OrderItem>();
        foreach (var row in rows.OrderBy(x => x.VariantId))
        {
            var available = inventory.Where(x => x.VariantId == row.VariantId).Sum(x => x.Available);
            if (available < row.Quantity) throw new DomainException($"Stock insuficiente para {variants[row.VariantId].Product!.Name}.");
            var variant = variants[row.VariantId];
            var product = variant.Product ?? throw new DomainException("El producto de la variante no está disponible.");
            var price = variant.PriceClp ?? product.BasePriceClp;
            orderItems.Add(new OrderItem(orderId, variant.Id, product.Name, variant.Sku, variant.Color, variant.Size, row.Quantity, price, 0));
        }

        var subtotal = orderItems.Sum(x => x.LineTotalClp);
        var shipping = subtotal >= 79_990 ? 0 : ShippingFor(request.ShippingAddress.Region);
        var couponCode = request.CouponCode ?? cart.CouponCode;
        var promotion = await LockPromotionAsync(couponCode, request.ShippingAddress.Email, cancellationToken);
        var discount = promotion?.CalculateDiscount(subtotal, shipping, DateTimeOffset.UtcNow) ?? 0;
        if (promotion is not null && discount == 0) throw new DomainException("El pedido no cumple las condiciones del cupón.");
        var number = $"RF-{DateTimeOffset.UtcNow:yyyy}-{RandomNumberGenerator.GetInt32(100000, 999999)}";
        var order = new Order(orderId, number, request.ShippingAddress.Email, subtotal, discount, shipping, orderItems);
        order.AssignCart(cart.Id);
        if (request.UserId.HasValue) order.AssignUser(request.UserId.Value);
        if (promotion is not null)
        {
            order.ApplyCoupon(promotion.Code);
            db.PromotionRedemptions.Add(new PromotionRedemption(promotion.Id, order.Id, request.ShippingAddress.Email, discount));
        }
        db.Orders.Add(order);
        db.OrderAddresses.Add(new OrderAddress(order.Id, $"{request.ShippingAddress.FirstName} {request.ShippingAddress.LastName}", request.ShippingAddress.Phone, request.ShippingAddress.Region, request.ShippingAddress.Commune, request.ShippingAddress.AddressLine1, request.ShippingAddress.AddressLine2, request.ShippingAddress.Instructions));

        var allocations = new List<StockReservationItem>();
        var now = DateTimeOffset.UtcNow;
        foreach (var row in rows.OrderBy(x => x.VariantId))
        {
            var remaining = row.Quantity;
            foreach (var item in inventory.Where(x => x.VariantId == row.VariantId).OrderBy(x => x.WarehouseId))
            {
                var reserve = Math.Min(remaining, item.Available);
                if (reserve == 0) continue;
                item.Reserve(reserve, now);
                allocations.Add(new StockReservationItem(item.Id, reserve));
                remaining -= reserve;
                if (remaining == 0) break;
            }
        }
        db.StockReservations.Add(new StockReservation(order.Id, now.AddMinutes(15), allocations));

        var response = new CreateOrderDto(order.Id, order.Number, order.TotalClp, order.Currency, "PendingPayment");
        var idempotency = new IdempotencyKey("checkout", keyHash, requestHash, now.AddHours(24));
        idempotency.Complete(201, JsonSerializer.Serialize(response), now);
        db.IdempotencyKeys.Add(idempotency);
        db.CartItems.RemoveRange(rows);
        await db.SaveChangesAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);
        return response;
    }

    private async Task<Cart> LoadCartAsync(string token, CancellationToken cancellationToken)
    {
        var hash = Hash(token);
        return await db.Carts.SingleOrDefaultAsync(x => x.GuestTokenHash == hash, cancellationToken) ?? throw new DomainException("La bolsa no existe o expiró.");
    }

    private async Task<long> CalculateSubtotalAsync(Guid cartId, CancellationToken cancellationToken) => await (from item in db.CartItems where item.CartId == cartId join variant in db.ProductVariants on item.VariantId equals variant.Id join product in db.Products on variant.ProductId equals product.Id select (variant.PriceClp ?? product.BasePriceClp) * item.Quantity).SumAsync(cancellationToken);
    private static long ShippingFor(string region) => region.Contains("Metropolitana", StringComparison.OrdinalIgnoreCase) ? 4_990 : 7_990;
    private static string Hash(string value) => Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(value)));

    private async Task<Promotion?> ActivePromotionAsync(string? code, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(code)) return null;
        var normalized = code.Trim().ToUpperInvariant();
        var now = DateTimeOffset.UtcNow;
        return await db.Promotions.AsNoTracking().SingleOrDefaultAsync(x => x.Code == normalized && x.IsActive && x.StartsAt <= now && x.EndsAt > now, cancellationToken) ?? throw new DomainException("El cupón no existe o no está vigente.");
    }

    private async Task<Promotion?> LockPromotionAsync(string? code, string customerEmail, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(code)) return null;
        var normalized = code.Trim().ToUpperInvariant();
        var promotion = await db.Promotions.FromSqlInterpolated($"SELECT * FROM promotions WHERE code = {normalized} FOR UPDATE").SingleOrDefaultAsync(cancellationToken) ?? throw new DomainException("El cupón no existe.");
        var now = DateTimeOffset.UtcNow;
        if (!promotion.IsActive || now < promotion.StartsAt || now >= promotion.EndsAt) throw new DomainException("El cupón no está vigente.");
        if (promotion.TotalUsageLimit.HasValue)
        {
            var used = await db.PromotionRedemptions.CountAsync(x => x.PromotionId == promotion.Id && x.Status != PromotionRedemptionStatus.Released, cancellationToken);
            if (used >= promotion.TotalUsageLimit.Value) throw new DomainException("El cupón agotó su límite de usos.");
        }
        if (promotion.PerCustomerLimit.HasValue)
        {
            var emailHash = Hash(customerEmail.Trim().ToLowerInvariant());
            var used = await db.PromotionRedemptions.CountAsync(x => x.PromotionId == promotion.Id && x.CustomerEmailHash == emailHash && x.Status != PromotionRedemptionStatus.Released, cancellationToken);
            if (used >= promotion.PerCustomerLimit.Value) throw new DomainException("Ya utilizaste el máximo permitido para este cupón.");
        }
        return promotion;
    }
}
