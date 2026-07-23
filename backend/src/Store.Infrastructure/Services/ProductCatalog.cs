using Microsoft.EntityFrameworkCore;
using Store.Application.Catalog;
using Store.Application.Common;
using Store.Domain.Common;
using Store.Infrastructure.Persistence;

namespace Store.Infrastructure.Services;

internal sealed class ProductCatalog(StoreDbContext db) : IProductCatalog
{
    public async Task<IReadOnlyList<CategoryDto>> GetCategoriesAsync(CancellationToken cancellationToken) =>
        await db.Categories.AsNoTracking().Where(x => x.IsVisible).OrderBy(x => x.DisplayOrder).ThenBy(x => x.Name)
            .Select(x => new CategoryDto(x.Id, x.Name, x.Slug, x.Description)).ToListAsync(cancellationToken);

    public async Task<PagedResult<ProductCardDto>> GetProductsAsync(ProductQuery query, CancellationToken cancellationToken)
    {
        var page = Math.Max(1, query.Page);
        var pageSize = Math.Clamp(query.PageSize, 1, 48);
        var products = db.Products.AsNoTracking().Where(x => x.Status == ProductStatus.Active);

        if (!string.IsNullOrWhiteSpace(query.Search))
        {
            var search = query.Search.Trim();
            products = products.Where(x => EF.Functions.ILike(x.Name, $"%{search}%") || EF.Functions.ILike(x.ShortDescription, $"%{search}%"));
        }
        if (!string.IsNullOrWhiteSpace(query.Category))
        {
            var category = query.Category.Trim().ToLowerInvariant();
            products = category switch
            {
                "mujer" => products.Where(x => x.Audience == "Mujer" || x.Audience == "Unisex"),
                "hombre" => products.Where(x => x.Audience == "Hombre" || x.Audience == "Unisex"),
                "unisex" => products.Where(x => x.Audience == "Unisex"),
                "abrigos" => products.Where(x => x.Category != null && (x.Category.Slug == "impermeables" || x.Category.Slug == "termicos" || x.Category.Slug == "urbano")),
                "tops" => products.Where(x => EF.Functions.ILike(x.Name, "%polera%") || EF.Functions.ILike(x.Name, "%camisa%") || EF.Functions.ILike(x.Name, "%primera capa%")),
                "pantalones" => products.Where(x => EF.Functions.ILike(x.Name, "%pantalón%") || EF.Functions.ILike(x.Name, "%short%")),
                _ => products.Where(x => x.Category != null && x.Category.Slug == category)
            };
        }
        if (!string.IsNullOrWhiteSpace(query.Color)) products = products.Where(x => x.Variants.Any(v => v.IsActive && v.Color == query.Color));
        if (!string.IsNullOrWhiteSpace(query.Size)) products = products.Where(x => x.Variants.Any(v => v.IsActive && v.Size == query.Size));
        if (!string.IsNullOrWhiteSpace(query.Function)) products = products.Where(x => x.FunctionalAttributes.Any(a => a.Attribute != null && a.Attribute.Slug == query.Function));
        if (query.MinPriceClp is not null) products = products.Where(x => x.BasePriceClp >= query.MinPriceClp);
        if (query.MaxPriceClp is not null) products = products.Where(x => x.BasePriceClp <= query.MaxPriceClp);

        products = query.Sort switch
        {
            "price_asc" => products.OrderBy(x => x.BasePriceClp).ThenBy(x => x.Name),
            "price_desc" => products.OrderByDescending(x => x.BasePriceClp).ThenBy(x => x.Name),
            "newest" => products.OrderByDescending(x => x.PublishedAt),
            _ => products.OrderByDescending(x => x.PublishedAt).ThenBy(x => x.Name)
        };

        var total = await products.CountAsync(cancellationToken);
        var items = await products.Skip((page - 1) * pageSize).Take(pageSize)
            .Select(x => new ProductCardDto(
                x.Id, x.Name, x.Slug, x.ShortDescription, x.BasePriceClp, x.CompareAtPriceClp, x.Currency,
                x.Images.OrderByDescending(i => i.IsPrimary).ThenBy(i => i.DisplayOrder).Select(i => i.Url).FirstOrDefault() ?? "/assets/products/placeholder.webp",
                x.Images.OrderByDescending(i => i.IsPrimary).ThenBy(i => i.DisplayOrder).Select(i => i.AltText).FirstOrDefault() ?? x.Name,
                x.Variants.Where(v => v.IsActive).Select(v => v.Color).Distinct().Take(5).ToList(),
                x.Variants.Any(v => v.IsActive && db.InventoryItems.Any(i => i.VariantId == v.Id && i.OnHand - i.Reserved > 0))))
            .ToListAsync(cancellationToken);

        return new PagedResult<ProductCardDto>(items, page, pageSize, total);
    }

    public async Task<ProductDetailDto?> GetBySlugAsync(string slug, CancellationToken cancellationToken)
    {
        var normalized = slug.Trim().ToLowerInvariant();
        return await db.Products.AsNoTracking().Where(x => x.Status == ProductStatus.Active && x.Slug == normalized)
            .Select(x => new ProductDetailDto(
                x.Id, x.Name, x.Slug, x.Description, x.ShortDescription, x.BasePriceClp, x.CompareAtPriceClp, x.Currency,
                new CategoryDto(x.CategoryId, x.Category!.Name, x.Category.Slug, x.Category.Description),
                x.Images.OrderBy(i => i.DisplayOrder).Select(i => new ProductImageDto(i.Url, i.AltText, i.IsPrimary, i.Width, i.Height)).ToList(),
                x.Variants.Where(v => v.IsActive).OrderBy(v => v.Color).ThenBy(v => v.Size)
                    .Select(v => new ProductVariantDto(v.Id, v.Sku, v.Color, v.ColorHex, v.Size, v.PriceClp ?? x.BasePriceClp,
                        db.InventoryItems.Any(i => i.VariantId == v.Id && i.OnHand - i.Reserved > 0),
                        db.InventoryItems.Where(i => i.VariantId == v.Id).Sum(i => i.OnHand - i.Reserved))).ToList(),
                x.FunctionalAttributes.OrderBy(a => a.DisplayOrder).Select(a => new FunctionalAttributeDto(a.Attribute!.Name, a.Value, a.Attribute.Unit)).ToList(),
                x.Materials, x.CareInstructions))
            .SingleOrDefaultAsync(cancellationToken);
    }
}
