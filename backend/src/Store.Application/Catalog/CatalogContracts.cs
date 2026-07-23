using Store.Application.Common;

namespace Store.Application.Catalog;

public sealed record CategoryDto(Guid Id, string Name, string Slug, string? Description);
public sealed record ProductImageDto(string Url, string AltText, bool IsPrimary, int Width, int Height);
public sealed record ProductVariantDto(Guid Id, string Sku, string Color, string ColorHex, string Size, long PriceClp, bool Available, int AvailableQuantity);
public sealed record FunctionalAttributeDto(string Name, string Value, string? Unit);
public sealed record ProductCardDto(Guid Id, string Name, string Slug, string ShortDescription, long PriceClp, long? CompareAtPriceClp, string Currency, string ImageUrl, string ImageAlt, IReadOnlyList<string> Colors, bool Available);
public sealed record ProductDetailDto(Guid Id, string Name, string Slug, string Description, string ShortDescription, long BasePriceClp, long? CompareAtPriceClp, string Currency, CategoryDto Category, IReadOnlyList<ProductImageDto> Images, IReadOnlyList<ProductVariantDto> Variants, IReadOnlyList<FunctionalAttributeDto> FunctionalAttributes, string Materials, string CareInstructions);

public sealed record ProductQuery(string? Search, string? Category, string? Color, string? Size, string? Function, long? MinPriceClp, long? MaxPriceClp, string Sort = "recommended", int Page = 1, int PageSize = 24);

public interface IProductCatalog
{
    Task<IReadOnlyList<CategoryDto>> GetCategoriesAsync(CancellationToken cancellationToken);
    Task<PagedResult<ProductCardDto>> GetProductsAsync(ProductQuery query, CancellationToken cancellationToken);
    Task<ProductDetailDto?> GetBySlugAsync(string slug, CancellationToken cancellationToken);
}

