using System.Security.Cryptography;
using System.Text;
using Microsoft.EntityFrameworkCore;
using Store.Application.Cart;
using Store.Domain.Commerce;
using Store.Domain.Catalog;
using Store.Domain.Common;
using Store.Infrastructure.Persistence;

namespace Store.Infrastructure.Services;

internal sealed class CartService(StoreDbContext db) : ICartService
{
    public async Task<CartDto> GetAsync(string cartToken, CancellationToken cancellationToken)
    {
        var cart = await GetOrCreateCartAsync(cartToken, cancellationToken);
        return await BuildDtoAsync(cart.Id, cancellationToken);
    }

    public async Task<CartDto> AddAsync(string cartToken, AddCartItemRequest request, CancellationToken cancellationToken)
    {
        if (request.Quantity is < 1 or > 10) throw new DomainException("La cantidad debe estar entre 1 y 10.");
        var available = await db.InventoryItems.Where(x => x.VariantId == request.VariantId).SumAsync(x => x.OnHand - x.Reserved, cancellationToken);
        if (available < request.Quantity) throw new DomainException("No hay stock suficiente para esa variante.");

        var cart = await GetOrCreateCartAsync(cartToken, cancellationToken);
        var existing = await db.CartItems.SingleOrDefaultAsync(x => x.CartId == cart.Id && x.VariantId == request.VariantId, cancellationToken);
        if (existing is null) db.CartItems.Add(new CartItem(cart.Id, request.VariantId, request.Quantity));
        else existing.SetQuantity(Math.Min(10, existing.Quantity + request.Quantity));
        await db.SaveChangesAsync(cancellationToken);
        return await BuildDtoAsync(cart.Id, cancellationToken);
    }

    public async Task<CartDto> UpdateAsync(string cartToken, Guid itemId, UpdateCartItemRequest request, CancellationToken cancellationToken)
    {
        var cart = await GetOrCreateCartAsync(cartToken, cancellationToken);
        var item = await db.CartItems.SingleOrDefaultAsync(x => x.Id == itemId && x.CartId == cart.Id, cancellationToken)
            ?? throw new KeyNotFoundException("El artículo no existe en esta bolsa.");
        var available = await db.InventoryItems.Where(x => x.VariantId == item.VariantId).SumAsync(x => x.OnHand - x.Reserved, cancellationToken);
        if (request.Quantity > available) throw new DomainException("La cantidad supera el stock disponible.");
        item.SetQuantity(request.Quantity);
        await db.SaveChangesAsync(cancellationToken);
        return await BuildDtoAsync(cart.Id, cancellationToken);
    }

    public async Task<CartDto> RemoveAsync(string cartToken, Guid itemId, CancellationToken cancellationToken)
    {
        var cart = await GetOrCreateCartAsync(cartToken, cancellationToken);
        var item = await db.CartItems.SingleOrDefaultAsync(x => x.Id == itemId && x.CartId == cart.Id, cancellationToken)
            ?? throw new KeyNotFoundException("El artículo no existe en esta bolsa.");
        db.CartItems.Remove(item);
        await db.SaveChangesAsync(cancellationToken);
        return await BuildDtoAsync(cart.Id, cancellationToken);
    }

    public async Task<CartDto> ApplyCouponAsync(string cartToken, string code, CancellationToken cancellationToken)
    {
        var cart = await GetOrCreateCartAsync(cartToken, cancellationToken);
        var subtotal = await CalculateSubtotalAsync(cart.Id, cancellationToken);
        var normalized = code.Trim().ToUpperInvariant();
        var now = DateTimeOffset.UtcNow;
        var promotion = await db.Promotions.AsNoTracking().SingleOrDefaultAsync(x => x.Code == normalized && x.IsActive && x.StartsAt <= now && x.EndsAt > now, cancellationToken)
            ?? throw new DomainException("El cupón no existe o no está vigente.");
        if (subtotal < promotion.MinimumOrderClp) throw new DomainException($"El cupón requiere una compra mínima de ${promotion.MinimumOrderClp:N0}.");
        cart.ApplyCoupon(normalized, now);
        await db.SaveChangesAsync(cancellationToken);
        return await BuildDtoAsync(cart.Id, cancellationToken);
    }

    public async Task<CartDto> RemoveCouponAsync(string cartToken, CancellationToken cancellationToken)
    {
        var cart = await GetOrCreateCartAsync(cartToken, cancellationToken);
        cart.RemoveCoupon(DateTimeOffset.UtcNow);
        await db.SaveChangesAsync(cancellationToken);
        return await BuildDtoAsync(cart.Id, cancellationToken);
    }

    private async Task<Cart> GetOrCreateCartAsync(string cartToken, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(cartToken) || cartToken.Length > 200) throw new DomainException("Identificador de bolsa inválido.");
        var hash = Hash(cartToken);
        var cart = await db.Carts.SingleOrDefaultAsync(x => x.GuestTokenHash == hash, cancellationToken);
        if (cart is not null) return cart;
        cart = new Cart(hash, DateTimeOffset.UtcNow.AddDays(30));
        db.Carts.Add(cart);
        await db.SaveChangesAsync(cancellationToken);
        return cart;
    }

    private async Task<CartDto> BuildDtoAsync(Guid cartId, CancellationToken cancellationToken)
    {
        var items = await db.CartItems.AsNoTracking().Where(x => x.CartId == cartId)
            .Select(x => new CartItemDto(
                x.Id, x.VariantId, x.VariantId.ToString(), string.Empty, string.Empty, string.Empty, string.Empty,
                "/assets/products/placeholder.webp", x.Quantity,
                db.InventoryItems.Where(i => i.VariantId == x.VariantId).Sum(i => i.OnHand - i.Reserved), 0, 0))
            .ToListAsync(cancellationToken);

        var variantIds = items.Select(x => x.VariantId).ToArray();
        var details = await db.ProductVariants.AsNoTracking().Where(x => variantIds.Contains(x.Id))
            .Select(x => new
            {
                x.Id, x.Sku, x.Color, x.Size, x.ProductId, x.Product!.Name, x.Product.Slug,
                Price = x.PriceClp ?? x.Product.BasePriceClp,
                Image = x.Product.Images.OrderByDescending(i => i.IsPrimary).ThenBy(i => i.DisplayOrder).Select(i => i.Url).FirstOrDefault()
            }).ToDictionaryAsync(x => x.Id, cancellationToken);

        var hydrated = items.Select(item =>
        {
            var detail = details[item.VariantId];
            return item with { ProductName = detail.Name, Slug = detail.Slug, Sku = detail.Sku, Color = detail.Color, Size = detail.Size, ImageUrl = detail.Image ?? "/assets/products/placeholder.webp", UnitPriceClp = detail.Price, LineTotalClp = checked(detail.Price * item.Quantity) };
        }).ToList();
        var subtotal = hydrated.Sum(x => x.LineTotalClp);
        var cart = await db.Carts.AsNoTracking().SingleAsync(x => x.Id == cartId, cancellationToken);
        var promotion = cart.CouponCode is null ? null : await db.Promotions.AsNoTracking().SingleOrDefaultAsync(x => x.Code == cart.CouponCode && x.IsActive && x.StartsAt <= DateTimeOffset.UtcNow && x.EndsAt > DateTimeOffset.UtcNow, cancellationToken);
        var discount = promotion?.CalculateDiscount(subtotal, 0, DateTimeOffset.UtcNow) ?? 0;
        return new CartDto(cartId, hydrated, subtotal, discount, 0, subtotal - discount, "CLP", promotion is null ? null : cart.CouponCode);
    }

    private async Task<long> CalculateSubtotalAsync(Guid cartId, CancellationToken cancellationToken) => await (from item in db.CartItems where item.CartId == cartId join variant in db.ProductVariants on item.VariantId equals variant.Id join product in db.Products on variant.ProductId equals product.Id select (variant.PriceClp ?? product.BasePriceClp) * item.Quantity).SumAsync(cancellationToken);

    private static string Hash(string value) => Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(value)));
}
