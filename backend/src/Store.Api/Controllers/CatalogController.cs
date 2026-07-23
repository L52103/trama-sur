using Microsoft.AspNetCore.Mvc;
using Store.Application.Catalog;
using Store.Application.Common;

namespace Store.Api.Controllers;

[ApiController]
[Route("api/v1")]
public sealed class CatalogController(IProductCatalog catalog) : ControllerBase
{
    [HttpGet("categories")]
    [ResponseCache(Duration = 120, Location = ResponseCacheLocation.Any)]
    public Task<IReadOnlyList<CategoryDto>> Categories(CancellationToken cancellationToken) => catalog.GetCategoriesAsync(cancellationToken);

    [HttpGet("products")]
    public Task<PagedResult<ProductCardDto>> Products([FromQuery] ProductQuery query, CancellationToken cancellationToken) => catalog.GetProductsAsync(query, cancellationToken);

    [HttpGet("products/{slug}")]
    public async Task<ActionResult<ProductDetailDto>> Product(string slug, CancellationToken cancellationToken)
    {
        var product = await catalog.GetBySlugAsync(slug, cancellationToken);
        return product is null ? NotFound() : Ok(product);
    }
}
