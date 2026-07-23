using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Store.Api.Infrastructure;
using Store.Domain.Catalog;
using Store.Domain.Commerce;
using Store.Domain.Common;
using Store.Infrastructure.Persistence;

namespace Store.Api.Controllers;

public sealed record AdminVariantRequest(string Sku, string Color, string ColorHex, string Size, string Cut, string? Barcode, long? PriceClp, int WeightGrams, int LowStockThreshold, int InitialStock);
public sealed record AdminProductRequest(string Name, string Slug, Guid CategoryId, string ShortDescription, string Description, string Materials, string CareInstructions, string Audience, long BasePriceClp, long? CompareAtPriceClp, string MetaTitle, string MetaDescription, string ImageUrl, string ImageAlt, IReadOnlyList<AdminVariantRequest> Variants, IReadOnlyList<Guid>? CollectionIds = null);
public sealed record InventoryAdjustmentRequest(Guid InventoryItemId, int QuantityDelta, string Reason, string? Reference);
public sealed record AdminVariantUpdateRequest(string Color, string ColorHex, string Size, string Cut, string? Barcode, long? PriceClp, int WeightGrams, int LowStockThreshold, bool IsActive);
public sealed record AdminImageRequest(string Url, string AltText, int DisplayOrder, bool IsPrimary, int Width, int Height);
public sealed record AdminCategoryRequest(string Name, string Slug, string? Description, int DisplayOrder, bool IsVisible);

[ApiController]
[Authorize(Policy = "CatalogWrite")]
[Route("api/v1/admin/products")]
public sealed class AdminProductsController(StoreDbContext db, IConfiguration configuration) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> List([FromQuery] string? search, CancellationToken cancellationToken)
    {
        var query = db.Products.AsNoTracking().Include(x => x.Category).Include(x => x.Variants).Include(x => x.Images).AsQueryable();
        if (!string.IsNullOrWhiteSpace(search)) query = query.Where(x => EF.Functions.ILike(x.Name, $"%{search.Trim()}%") || EF.Functions.ILike(x.Slug, $"%{search.Trim()}%"));
        var rawProducts = await query.OrderByDescending(x => x.UpdatedAt).Take(200).ToListAsync(cancellationToken);
        
        var variantIds = rawProducts.SelectMany(p => p.Variants).Select(v => v.Id).ToList();
        var inventory = await db.InventoryItems.Where(i => variantIds.Contains(i.VariantId)).ToListAsync(cancellationToken);
        var stockDict = inventory.GroupBy(i => i.VariantId).ToDictionary(g => g.Key, g => g.Sum(i => i.OnHand - i.Reserved));
        
        var products = rawProducts.Select(x => new { x.Id, x.Name, x.Slug, category = x.Category!.Name, x.Status, x.BasePriceClp, x.CompareAtPriceClp, variants = x.Variants.Count, imageUrl = x.Images.OrderByDescending(i => i.IsPrimary).Select(i => i.Url).FirstOrDefault(), x.UpdatedAt, stockAvailable = x.Variants.Sum(v => stockDict.GetValueOrDefault(v.Id, 0)) });
        
        return Ok(products);
    }

    [HttpGet("{id:guid}")]
    public async Task<IActionResult> Get(Guid id, CancellationToken cancellationToken)
    {
        var product = await db.Products.AsNoTracking().Include(x => x.Category).Include(x => x.Variants).Include(x => x.Images).Include(x => x.FunctionalAttributes).SingleOrDefaultAsync(x => x.Id == id, cancellationToken);
        return product is null ? NotFound() : Ok(product);
    }

    [HttpPost]
    public async Task<IActionResult> Create(AdminProductRequest request, CancellationToken cancellationToken)
    {
        var normalizedSlug = request.Slug.Trim().ToLowerInvariant();
        if (await db.Products.AnyAsync(x => x.Slug == normalizedSlug, cancellationToken)) throw new DomainException("Ya existe un producto con ese slug.");
        var warehouse = await db.Warehouses.Where(x => x.IsActive).OrderBy(x => x.Code).FirstOrDefaultAsync(cancellationToken) ?? throw new DomainException("No existe una bodega activa.");
        await using var transaction = await db.Database.BeginTransactionAsync(cancellationToken);
        var product = new Product(request.Name, request.Slug, request.CategoryId, request.ShortDescription, request.BasePriceClp);
        product.SetDetails(request.Description, request.Materials, request.CareInstructions, request.Audience, request.MetaTitle, request.MetaDescription);
        product.ChangePrice(request.BasePriceClp, request.CompareAtPriceClp, DateTimeOffset.UtcNow);
        product.AddImage(new ProductImage(product.Id, request.ImageUrl, request.ImageAlt, 0, true, 1200, 1500));
        foreach (var variantRequest in request.Variants)
        {
            var variant = new ProductVariant(product.Id, variantRequest.Sku, variantRequest.Color, variantRequest.Size, variantRequest.PriceClp);
            variant.Update(variantRequest.Color, variantRequest.ColorHex, variantRequest.Size, variantRequest.Cut, variantRequest.Barcode, variantRequest.PriceClp, variantRequest.WeightGrams, variantRequest.LowStockThreshold, true, DateTimeOffset.UtcNow);
            product.AddVariant(variant);
            db.InventoryItems.Add(new InventoryItem(warehouse.Id, variant.Id, variantRequest.InitialStock));
        }
        db.Products.Add(product);
        if (request.CollectionIds is not null)
        {
            foreach (var collId in request.CollectionIds)
            {
                db.ProductCollectionItems.Add(new Store.Domain.Catalog.ProductCollectionItem(collId, product.Id, 0));
            }
        }
        db.AuditLogs.Add(AuditLogFactory.Create(User, HttpContext, configuration, "ProductCreated", "Product", product.Id.ToString(), new { request.Name, request.Slug, variantCount = request.Variants.Count }));
        await db.SaveChangesAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);
        return CreatedAtAction(nameof(Get), new { id = product.Id }, new { product.Id, product.Name, product.Status });
    }

    [HttpPut("{id:guid}")]
    public async Task<IActionResult> Update(Guid id, AdminProductRequest request, CancellationToken cancellationToken)
    {
        var product = await db.Products.Include(x => x.Variants).SingleOrDefaultAsync(x => x.Id == id, cancellationToken) ?? throw new KeyNotFoundException();
        product.UpdateBasics(request.Name, request.CategoryId, request.ShortDescription, request.BasePriceClp, request.CompareAtPriceClp, DateTimeOffset.UtcNow);
        product.SetDetails(request.Description, request.Materials, request.CareInstructions, request.Audience, request.MetaTitle, request.MetaDescription);
        
        var requestSkus = request.Variants.Select(v => v.Sku).ToList();
        var toRemove = product.Variants.Where(v => !requestSkus.Contains(v.Sku)).ToList();
        foreach (var v in toRemove) product.RemoveVariant(v);

        var warehouse = await db.Warehouses.Where(x => x.IsActive).OrderBy(x => x.Code).FirstOrDefaultAsync(cancellationToken) ?? throw new DomainException("No existe una bodega activa.");

        foreach (var vr in request.Variants)
        {
            var existing = product.Variants.SingleOrDefault(v => v.Sku == vr.Sku);
            if (existing is null)
            {
                var newVar = new ProductVariant(product.Id, vr.Sku, vr.Color, vr.Size, vr.PriceClp);
                newVar.Update(vr.Color, vr.ColorHex, vr.Size, vr.Cut, vr.Barcode, vr.PriceClp, vr.WeightGrams, vr.LowStockThreshold, true, DateTimeOffset.UtcNow);
                product.AddVariant(newVar);
                db.InventoryItems.Add(new Store.Domain.Commerce.InventoryItem(warehouse.Id, newVar.Id, vr.InitialStock));
            }
            else
            {
                existing.Update(vr.Color, vr.ColorHex, vr.Size, vr.Cut, vr.Barcode, vr.PriceClp, vr.WeightGrams, vr.LowStockThreshold, true, DateTimeOffset.UtcNow);
            }
        }

        db.AuditLogs.Add(AuditLogFactory.Create(User, HttpContext, configuration, "ProductUpdated", "Product", id.ToString(), new { request.Name, request.CategoryId, request.BasePriceClp, request.CompareAtPriceClp }));
        await db.SaveChangesAsync(cancellationToken);
        return NoContent();
    }

    [HttpPost("{id:guid}/publish")]
    public async Task<IActionResult> Publish(Guid id, CancellationToken cancellationToken)
    {
        var product = await db.Products.Include(x => x.Variants).Include(x => x.Images).SingleOrDefaultAsync(x => x.Id == id, cancellationToken) ?? throw new KeyNotFoundException();
        product.Publish(DateTimeOffset.UtcNow);
        db.AuditLogs.Add(AuditLogFactory.Create(User, HttpContext, configuration, "ProductPublished", "Product", id.ToString(), new { product.Name }));
        await db.SaveChangesAsync(cancellationToken);
        return NoContent();
    }

    [HttpPost("{id:guid}/archive")]
    public async Task<IActionResult> Archive(Guid id, CancellationToken cancellationToken)
    {
        var product = await db.Products.SingleOrDefaultAsync(x => x.Id == id, cancellationToken) ?? throw new KeyNotFoundException();
        product.Archive(DateTimeOffset.UtcNow);
        db.AuditLogs.Add(AuditLogFactory.Create(User, HttpContext, configuration, "ProductArchived", "Product", id.ToString(), new { product.Name }));
        await db.SaveChangesAsync(cancellationToken);
        return NoContent();
    }

    [HttpPost("{id:guid}/unarchive")]
    public async Task<IActionResult> Unarchive(Guid id, CancellationToken cancellationToken)
    {
        var product = await db.Products.SingleOrDefaultAsync(x => x.Id == id, cancellationToken) ?? throw new KeyNotFoundException();
        product.Unarchive(DateTimeOffset.UtcNow);
        db.AuditLogs.Add(AuditLogFactory.Create(User, HttpContext, configuration, "ProductUnarchived", "Product", id.ToString(), new { product.Name }));
        await db.SaveChangesAsync(cancellationToken);
        return NoContent();
    }

    [HttpPost("{id:guid}/duplicate")]
    public async Task<IActionResult> Duplicate(Guid id, CancellationToken cancellationToken)
    {
        var source = await db.Products.AsNoTracking().Include(x => x.Variants).Include(x => x.Images).Include(x => x.FunctionalAttributes).SingleOrDefaultAsync(x => x.Id == id, cancellationToken) ?? throw new KeyNotFoundException();
        var suffix = Random.Shared.Next(1000, 9999).ToString(System.Globalization.CultureInfo.InvariantCulture);
        var copy = new Product($"{source.Name} (copia)", $"{source.Slug}-copia-{suffix}", source.CategoryId, source.ShortDescription, source.BasePriceClp);
        copy.SetDetails(source.Description, source.Materials, source.CareInstructions, source.Audience, source.MetaTitle, source.MetaDescription);
        copy.ChangePrice(source.BasePriceClp, source.CompareAtPriceClp, DateTimeOffset.UtcNow);
        foreach (var image in source.Images) copy.AddImage(new ProductImage(copy.Id, image.Url, image.AltText, image.DisplayOrder, image.IsPrimary, image.Width, image.Height));
        foreach (var variant in source.Variants)
        {
            var cloned = new ProductVariant(copy.Id, $"{variant.Sku}-C{suffix}", variant.Color, variant.Size, variant.PriceClp);
            cloned.Update(variant.Color, variant.ColorHex, variant.Size, variant.Cut, null, variant.PriceClp, variant.WeightGrams, variant.LowStockThreshold, variant.IsActive, DateTimeOffset.UtcNow);
            copy.AddVariant(cloned);
        }
        foreach (var feature in source.FunctionalAttributes) copy.AddFunctionalAttribute(new ProductFunctionalFeature(copy.Id, feature.FunctionalAttributeId, feature.Value, feature.DisplayOrder));
        db.Products.Add(copy);
        db.AuditLogs.Add(AuditLogFactory.Create(User, HttpContext, configuration, "ProductDuplicated", "Product", copy.Id.ToString(), new { sourceId = source.Id, copy.Name }));
        await db.SaveChangesAsync(cancellationToken);
        return CreatedAtAction(nameof(Get), new { id = copy.Id }, new { copy.Id, copy.Name, copy.Slug, copy.Status });
    }

    [HttpPost("{id:guid}/variants")]
    public async Task<IActionResult> AddVariant(Guid id, AdminVariantRequest request, CancellationToken cancellationToken)
    {
        if (!await db.Products.AnyAsync(x => x.Id == id, cancellationToken)) throw new KeyNotFoundException();
        var normalizedSku = request.Sku.Trim().ToUpperInvariant();
        if (await db.ProductVariants.AnyAsync(x => x.Sku == normalizedSku, cancellationToken)) throw new DomainException("El SKU ya existe.");
        var warehouse = await db.Warehouses.Where(x => x.IsActive).OrderBy(x => x.Code).FirstAsync(cancellationToken);
        var variant = new ProductVariant(id, request.Sku, request.Color, request.Size, request.PriceClp);
        variant.Update(request.Color, request.ColorHex, request.Size, request.Cut, request.Barcode, request.PriceClp, request.WeightGrams, request.LowStockThreshold, true, DateTimeOffset.UtcNow);
        db.ProductVariants.Add(variant);
        db.InventoryItems.Add(new InventoryItem(warehouse.Id, variant.Id, request.InitialStock));
        db.AuditLogs.Add(AuditLogFactory.Create(User, HttpContext, configuration, "ProductVariantCreated", "ProductVariant", variant.Id.ToString(), new { ProductId = id, variant.Sku, variant.Color, variant.Size, request.InitialStock }));
        await db.SaveChangesAsync(cancellationToken);
        return Created($"/api/v1/admin/products/{id}", new { variant.Id, variant.Sku });
    }

    [HttpPut("{id:guid}/variants/{variantId:guid}")]
    public async Task<IActionResult> UpdateVariant(Guid id, Guid variantId, AdminVariantUpdateRequest request, CancellationToken cancellationToken)
    {
        var variant = await db.ProductVariants.SingleOrDefaultAsync(x => x.Id == variantId && x.ProductId == id, cancellationToken) ?? throw new KeyNotFoundException();
        variant.Update(request.Color, request.ColorHex, request.Size, request.Cut, request.Barcode, request.PriceClp, request.WeightGrams, request.LowStockThreshold, request.IsActive, DateTimeOffset.UtcNow);
        db.AuditLogs.Add(AuditLogFactory.Create(User, HttpContext, configuration, "ProductVariantUpdated", "ProductVariant", variant.Id.ToString(), request));
        await db.SaveChangesAsync(cancellationToken);
        return NoContent();
    }

    [HttpDelete("{id:guid}/variants/{variantId:guid}")]
    public async Task<IActionResult> DeactivateVariant(Guid id, Guid variantId, CancellationToken cancellationToken)
    {
        var variant = await db.ProductVariants.SingleOrDefaultAsync(x => x.Id == variantId && x.ProductId == id, cancellationToken) ?? throw new KeyNotFoundException();
        variant.Update(variant.Color, variant.ColorHex, variant.Size, variant.Cut, variant.Barcode, variant.PriceClp, variant.WeightGrams, variant.LowStockThreshold, false, DateTimeOffset.UtcNow);
        db.AuditLogs.Add(AuditLogFactory.Create(User, HttpContext, configuration, "ProductVariantDeactivated", "ProductVariant", variant.Id.ToString(), new { ProductId = id, variant.Sku }));
        await db.SaveChangesAsync(cancellationToken);
        return NoContent();
    }

    [HttpPost("{id:guid}/images")]
    public async Task<IActionResult> AddImage(Guid id, AdminImageRequest request, CancellationToken cancellationToken)
    {
        if (!await db.Products.AnyAsync(x => x.Id == id, cancellationToken)) throw new KeyNotFoundException();
        if (request.IsPrimary && await db.ProductImages.AnyAsync(x => x.ProductId == id && x.IsPrimary, cancellationToken)) throw new DomainException("Ya existe una imagen principal.");
        var image = new ProductImage(id, request.Url, request.AltText, request.DisplayOrder, request.IsPrimary, request.Width, request.Height);
        db.ProductImages.Add(image);
        db.AuditLogs.Add(AuditLogFactory.Create(User, HttpContext, configuration, "ProductImageCreated", "ProductImage", image.Id.ToString(), new { ProductId = id, request.Url, request.IsPrimary }));
        await db.SaveChangesAsync(cancellationToken);
        return Created($"/api/v1/admin/products/{id}", new { image.Id });
    }

    [HttpDelete("{id:guid}/images/{imageId:guid}")]
    public async Task<IActionResult> DeleteImage(Guid id, Guid imageId, CancellationToken cancellationToken)
    {
        var image = await db.ProductImages.SingleOrDefaultAsync(x => x.Id == imageId && x.ProductId == id, cancellationToken) ?? throw new KeyNotFoundException();
        if (image.IsPrimary && await db.Products.AnyAsync(x => x.Id == id && x.Status == ProductStatus.Active, cancellationToken)) throw new DomainException("Asigna otra imagen principal antes de eliminar la imagen publicada.");
        db.ProductImages.Remove(image);
        db.AuditLogs.Add(AuditLogFactory.Create(User, HttpContext, configuration, "ProductImageDeleted", "ProductImage", image.Id.ToString(), new { ProductId = id, image.Url }));
        await db.SaveChangesAsync(cancellationToken);
        return NoContent();
    }

    [HttpGet("{id:guid}/history")]
    public async Task<IActionResult> History(Guid id, CancellationToken cancellationToken) => Ok(await db.AuditLogs.AsNoTracking().Where(x => x.ResourceId == id.ToString() || x.ChangesJson.Contains(id.ToString())).OrderByDescending(x => x.CreatedAt).Take(200).ToListAsync(cancellationToken));
}

[ApiController]
[Authorize(Policy = "InventoryWrite")]
[Route("api/v1/admin/inventory")]
public sealed class AdminInventoryController(StoreDbContext db, IConfiguration configuration) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> List(CancellationToken cancellationToken) => Ok(await db.InventoryItems.AsNoTracking().Join(db.ProductVariants, i => i.VariantId, v => v.Id, (i, v) => new { i.Id, i.WarehouseId, i.VariantId, v.Sku, v.Color, v.Size, i.OnHand, i.Reserved, Available = i.OnHand - i.Reserved, v.LowStockThreshold }).OrderBy(x => x.Sku).Take(1000).ToListAsync(cancellationToken));

    public sealed record UpdateThresholdRequest(int Threshold);

    [HttpPut("{variantId:guid}/threshold")]
    public async Task<IActionResult> UpdateThreshold(Guid variantId, UpdateThresholdRequest request, CancellationToken cancellationToken)
    {
        var variant = await db.ProductVariants.SingleOrDefaultAsync(x => x.Id == variantId, cancellationToken) ?? throw new KeyNotFoundException();
        variant.SetLowStockThreshold(request.Threshold);
        db.AuditLogs.Add(AuditLogFactory.Create(User, HttpContext, configuration, "LowStockThresholdUpdated", "ProductVariant", variantId.ToString(), new { request.Threshold }));
        await db.SaveChangesAsync(cancellationToken);
        return NoContent();
    }

    [HttpPut("threshold/bulk")]
    public async Task<IActionResult> BulkUpdateThreshold(UpdateThresholdRequest request, CancellationToken cancellationToken)
    {
        if (request.Threshold < 0) throw new DomainException("El umbral no puede ser negativo.");
        await db.ProductVariants.ExecuteUpdateAsync(s => s.SetProperty(v => v.LowStockThreshold, request.Threshold), cancellationToken);
        db.AuditLogs.Add(AuditLogFactory.Create(User, HttpContext, configuration, "BulkLowStockThresholdUpdated", "ProductVariant", "ALL", new { request.Threshold }));
        return NoContent();
    }

    [HttpPost("adjustments")]
    public async Task<IActionResult> Adjust(InventoryAdjustmentRequest request, CancellationToken cancellationToken)
    {
        if (request.QuantityDelta == 0 || Math.Abs((long)request.QuantityDelta) > 100_000) throw new DomainException("El ajuste no es válido.");
        await using var transaction = await db.Database.BeginTransactionAsync(cancellationToken);
        var item = await db.InventoryItems.FromSqlInterpolated($"SELECT i.*, i.xmin FROM inventory_items AS i WHERE i.id = {request.InventoryItemId} FOR UPDATE").SingleOrDefaultAsync(cancellationToken) ?? throw new KeyNotFoundException();
        var previous = item.OnHand;
        item.AdjustOnHand(request.QuantityDelta, DateTimeOffset.UtcNow);
        db.InventoryMovements.Add(new InventoryMovement(item.Id, InventoryMovementType.ManualAdjustment, request.QuantityDelta, previous, item.OnHand, request.Reason, request.Reference, UserId()));
        db.AuditLogs.Add(AuditLogFactory.Create(User, HttpContext, configuration, "InventoryAdjusted", "InventoryItem", item.Id.ToString(), new { request.QuantityDelta, request.Reason, previous, item.OnHand }));
        await db.SaveChangesAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);
        return Ok(new { item.Id, item.OnHand, item.Reserved, item.Available });
    }

    private Guid? UserId() => Guid.TryParse(User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value, out var id) ? id : null;
}

[ApiController]
[Authorize(Policy = "CatalogWrite")]
[Route("api/v1/admin/categories")]
public sealed class AdminCategoriesController(StoreDbContext db, IConfiguration configuration) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> List(CancellationToken cancellationToken) => Ok(await db.Categories.AsNoTracking().OrderBy(x => x.DisplayOrder).ToListAsync(cancellationToken));

    [HttpPost]
    public async Task<IActionResult> Create(AdminCategoryRequest request, CancellationToken cancellationToken)
    {
        var normalizedSlug = request.Slug.Trim().ToLowerInvariant();
        if (await db.Categories.AnyAsync(x => x.Slug == normalizedSlug, cancellationToken)) throw new DomainException("El slug de categoría ya existe.");
        var category = new Category(request.Name, normalizedSlug);
        category.Update(request.Name, request.Description, request.DisplayOrder, request.IsVisible, DateTimeOffset.UtcNow);
        db.Categories.Add(category);
        db.AuditLogs.Add(AuditLogFactory.Create(User, HttpContext, configuration, "CategoryCreated", "Category", category.Id.ToString(), request));
        await db.SaveChangesAsync(cancellationToken);
        return Created($"/api/v1/admin/categories/{category.Id}", category);
    }

    [HttpPut("{id:guid}")]
    public async Task<IActionResult> Update(Guid id, AdminCategoryRequest request, CancellationToken cancellationToken)
    {
        var category = await db.Categories.SingleOrDefaultAsync(x => x.Id == id, cancellationToken) ?? throw new KeyNotFoundException();
        category.Update(request.Name, request.Description, request.DisplayOrder, request.IsVisible, DateTimeOffset.UtcNow);
        db.AuditLogs.Add(AuditLogFactory.Create(User, HttpContext, configuration, "CategoryUpdated", "Category", id.ToString(), request));
        await db.SaveChangesAsync(cancellationToken);
        return NoContent();
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken cancellationToken)
    {
        if (await db.Products.AnyAsync(x => x.CategoryId == id, cancellationToken)) throw new DomainException("No se puede eliminar una categoría con productos.");
        var category = await db.Categories.SingleOrDefaultAsync(x => x.Id == id, cancellationToken) ?? throw new KeyNotFoundException();
        db.Categories.Remove(category);
        db.AuditLogs.Add(AuditLogFactory.Create(User, HttpContext, configuration, "CategoryDeleted", "Category", id.ToString(), new { category.Name, category.Slug }));
        await db.SaveChangesAsync(cancellationToken);
        return NoContent();
    }
}
