using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Store.Api.Infrastructure;
using Store.Domain.Catalog;
using Store.Domain.Common;
using Store.Infrastructure.Persistence;

namespace Store.Api.Controllers;

public sealed record PromotionRequest(string Name, string Code, PromotionType Type, long Value, long MinimumOrderClp, DateTimeOffset StartsAt, DateTimeOffset EndsAt, int? TotalUsageLimit, int? PerCustomerLimit, bool IsActive);
public sealed record CollectionRequest(string Name, string Slug, string Description, bool IsVisible, int DisplayOrder, IReadOnlyList<Guid> ProductIds);

[ApiController]
[Authorize(Policy = "CatalogWrite")]
[Route("api/v1/admin/promotions")]
public sealed class AdminPromotionsController(StoreDbContext db, IConfiguration configuration) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> List(CancellationToken cancellationToken) => Ok(await db.Promotions.AsNoTracking().OrderByDescending(x => x.CreatedAt).ToListAsync(cancellationToken));

    [HttpPost]
    public async Task<IActionResult> Create(PromotionRequest request, CancellationToken cancellationToken)
    {
        var normalized = request.Code.Trim().ToUpperInvariant();
        if (await db.Promotions.AnyAsync(x => x.Code == normalized, cancellationToken)) throw new DomainException("El código ya existe.");
        var promotion = new Promotion(request.Name, normalized, request.Type, request.Value, request.MinimumOrderClp, request.StartsAt, request.EndsAt, request.TotalUsageLimit, request.PerCustomerLimit);
        if (!request.IsActive) promotion.Deactivate(DateTimeOffset.UtcNow);
        db.Promotions.Add(promotion);
        db.AuditLogs.Add(AuditLogFactory.Create(User, HttpContext, configuration, "PromotionCreated", "Promotion", promotion.Id.ToString(), new { request.Name, Code = normalized, request.Type, request.Value }));
        await db.SaveChangesAsync(cancellationToken);
        return Created($"/api/v1/admin/promotions/{promotion.Id}", promotion);
    }

    [HttpPut("{id:guid}")]
    public async Task<IActionResult> Update(Guid id, PromotionRequest request, CancellationToken cancellationToken)
    {
        var promotion = await db.Promotions.SingleOrDefaultAsync(x => x.Id == id, cancellationToken) ?? throw new KeyNotFoundException();
        promotion.Update(request.Name, request.Type, request.Value, request.MinimumOrderClp, request.StartsAt, request.EndsAt, request.TotalUsageLimit, request.PerCustomerLimit, request.IsActive, DateTimeOffset.UtcNow);
        db.AuditLogs.Add(AuditLogFactory.Create(User, HttpContext, configuration, "PromotionUpdated", "Promotion", id.ToString(), new { request.Name, request.Type, request.Value, request.IsActive }));
        await db.SaveChangesAsync(cancellationToken);
        return NoContent();
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Deactivate(Guid id, CancellationToken cancellationToken)
    {
        var promotion = await db.Promotions.SingleOrDefaultAsync(x => x.Id == id, cancellationToken) ?? throw new KeyNotFoundException();
        promotion.Deactivate(DateTimeOffset.UtcNow);
        db.AuditLogs.Add(AuditLogFactory.Create(User, HttpContext, configuration, "PromotionDeactivated", "Promotion", id.ToString(), new { promotion.Code }));
        await db.SaveChangesAsync(cancellationToken);
        return NoContent();
    }
}

[ApiController]
[Authorize(Policy = "CatalogWrite")]
[Route("api/v1/admin/collections")]
public sealed class AdminCollectionsController(StoreDbContext db, IConfiguration configuration) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> List(CancellationToken cancellationToken) => Ok(await db.Collections.AsNoTracking().Include(x => x.Items).OrderBy(x => x.DisplayOrder).ToListAsync(cancellationToken));

    [HttpPost]
    public async Task<IActionResult> Create(CollectionRequest request, CancellationToken cancellationToken)
    {
        var normalized = request.Slug.Trim().ToLowerInvariant();
        if (await db.Collections.AnyAsync(x => x.Slug == normalized, cancellationToken)) throw new DomainException("El slug ya existe.");
        var collection = new ProductGroup(request.Name, normalized, request.Description);
        collection.Update(request.Name, request.Description, request.IsVisible, request.DisplayOrder, DateTimeOffset.UtcNow);
        for (var index = 0; index < request.ProductIds.Count; index++) collection.AddProduct(request.ProductIds[index], index);
        db.Collections.Add(collection);
        db.AuditLogs.Add(AuditLogFactory.Create(User, HttpContext, configuration, "CollectionCreated", "ProductCollection", collection.Id.ToString(), new { request.Name, Slug = normalized, productCount = request.ProductIds.Count }));
        await db.SaveChangesAsync(cancellationToken);
        return Created($"/api/v1/admin/collections/{collection.Id}", collection);
    }

    [HttpPut("{id:guid}")]
    public async Task<IActionResult> Update(Guid id, CollectionRequest request, CancellationToken cancellationToken)
    {
        var collection = await db.Collections.Include(x => x.Items).SingleOrDefaultAsync(x => x.Id == id, cancellationToken) ?? throw new KeyNotFoundException();
        collection.Update(request.Name, request.Description, request.IsVisible, request.DisplayOrder, DateTimeOffset.UtcNow);
        db.ProductCollectionItems.RemoveRange(collection.Items);
        for (var index = 0; index < request.ProductIds.Count; index++) db.ProductCollectionItems.Add(new ProductCollectionItem(collection.Id, request.ProductIds[index], index));
        db.AuditLogs.Add(AuditLogFactory.Create(User, HttpContext, configuration, "CollectionUpdated", "ProductCollection", id.ToString(), new { request.Name, productCount = request.ProductIds.Count }));
        await db.SaveChangesAsync(cancellationToken);
        return NoContent();
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken cancellationToken)
    {
        var collection = await db.Collections.SingleOrDefaultAsync(x => x.Id == id, cancellationToken) ?? throw new KeyNotFoundException();
        db.Collections.Remove(collection);
        db.AuditLogs.Add(AuditLogFactory.Create(User, HttpContext, configuration, "CollectionDeleted", "ProductCollection", id.ToString(), new { collection.Name, collection.Slug }));
        await db.SaveChangesAsync(cancellationToken);
        return NoContent();
    }
}

[ApiController]
[Route("api/v1/collections")]
public sealed class CollectionsController(StoreDbContext db) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> List(CancellationToken cancellationToken) => Ok(await db.Collections.AsNoTracking().Where(x => x.IsVisible).OrderBy(x => x.DisplayOrder).Select(x => new { x.Id, x.Name, x.Slug, x.Description }).ToListAsync(cancellationToken));

    [HttpGet("{slug}")]
    public async Task<IActionResult> Get(string slug, CancellationToken cancellationToken)
    {
        var normalized = slug.Trim().ToLowerInvariant();
        var collection = await db.Collections.AsNoTracking().SingleOrDefaultAsync(x => x.Slug == normalized && x.IsVisible, cancellationToken);
        if (collection is null) return NotFound();
        var products = await db.ProductCollectionItems.AsNoTracking().Where(x => x.CollectionId == collection.Id).OrderBy(x => x.DisplayOrder).Join(db.Products.Where(p => p.Status == ProductStatus.Active), item => item.ProductId, product => product.Id, (item, product) => new { product.Id, product.Name, product.Slug, product.ShortDescription, product.BasePriceClp }).ToListAsync(cancellationToken);
        return Ok(new { collection.Id, collection.Name, collection.Slug, collection.Description, products });
    }
}
