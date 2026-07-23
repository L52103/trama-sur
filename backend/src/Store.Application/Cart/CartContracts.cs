namespace Store.Application.Cart;

public sealed record CartItemDto(Guid Id, Guid VariantId, string ProductName, string Slug, string Sku, string Color, string Size, string ImageUrl, int Quantity, int AvailableQuantity, long UnitPriceClp, long LineTotalClp);
public sealed record CartDto(Guid Id, IReadOnlyList<CartItemDto> Items, long SubtotalClp, long DiscountClp, long ShippingClp, long TotalClp, string Currency, string? CouponCode);
public sealed record AddCartItemRequest(Guid VariantId, int Quantity);
public sealed record UpdateCartItemRequest(int Quantity);
public sealed record ApplyCouponRequest(string Code);

public interface ICartService
{
    Task<CartDto> GetAsync(string cartToken, CancellationToken cancellationToken);
    Task<CartDto> AddAsync(string cartToken, AddCartItemRequest request, CancellationToken cancellationToken);
    Task<CartDto> UpdateAsync(string cartToken, Guid itemId, UpdateCartItemRequest request, CancellationToken cancellationToken);
    Task<CartDto> RemoveAsync(string cartToken, Guid itemId, CancellationToken cancellationToken);
    Task<CartDto> ApplyCouponAsync(string cartToken, string code, CancellationToken cancellationToken);
    Task<CartDto> RemoveCouponAsync(string cartToken, CancellationToken cancellationToken);
}
