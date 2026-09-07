using System.Security.Claims;
using System.Text.Json;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Store.Api.Infrastructure;
using Store.Domain.Common;
using Store.Domain.Operations;
using Store.Infrastructure.Persistence;

namespace Store.Api.Controllers;

public sealed record OrderTransitionRequest(OrderStatus Status, string Reason);
public sealed record ContentDraftRequest(JsonElement Content);
public sealed record ContentPublishRequest(Guid VersionId, string Note);

[ApiController]
[Authorize(Policy = "OrderWrite")]
[Route("api/v1/admin/orders")]
public sealed class AdminOrdersController(StoreDbContext db, IConfiguration configuration) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> List([FromQuery] OrderStatus? status, CancellationToken cancellationToken)
    {
        var query = db.Orders.AsNoTracking().AsQueryable();
        if (status.HasValue) query = query.Where(x => x.Status == status.Value);
        return Ok(await query.OrderByDescending(x => x.CreatedAt).Take(300).Select(x => new { x.Id, x.Number, x.CustomerEmail, x.Status, x.TotalClp, x.Currency, x.PaidAt, x.CreatedAt, itemCount = x.Items.Sum(i => i.Quantity) }).ToListAsync(cancellationToken));
    }

    [HttpGet("{id:guid}")]
    public async Task<IActionResult> Get(Guid id, CancellationToken cancellationToken)
    {
        var order = await db.Orders.AsNoTracking().Include(x => x.Items).Include(x => x.History).SingleOrDefaultAsync(x => x.Id == id, cancellationToken);
        var address = await db.OrderAddresses.AsNoTracking().SingleOrDefaultAsync(x => x.OrderId == id, cancellationToken);
        return order is null ? NotFound() : Ok(new { order, address });
    }

    [HttpPut("{id:guid}/status")]
    public async Task<IActionResult> Transition(Guid id, OrderTransitionRequest request, CancellationToken cancellationToken)
    {
        var order = await db.Orders.SingleOrDefaultAsync(x => x.Id == id, cancellationToken) ?? throw new KeyNotFoundException();
        var previous = order.Status;
        order.TransitionTo(request.Status, DateTimeOffset.UtcNow);
        db.AuditLogs.Add(AuditLogFactory.Create(User, HttpContext, configuration, "OrderStatusChanged", "Order", id.ToString(), new { From = previous, To = request.Status, request.Reason }));
        await db.SaveChangesAsync(cancellationToken);
        return NoContent();
    }
}

[ApiController]
[Authorize(Policy = "ContentPublish")]
[Route("api/v1/admin/pages")]
public sealed class AdminContentController(StoreDbContext db, IConfiguration configuration) : ControllerBase
{
    [HttpGet("{key}/draft")]
    public async Task<IActionResult> Draft(string key, CancellationToken cancellationToken)
    {
        var normalizedKey = key.Trim().ToLowerInvariant();
        var page = await db.ContentPages.AsNoTracking().Include(x => x.Versions).SingleOrDefaultAsync(x => x.Key == normalizedKey, cancellationToken);
        var draft = page?.Versions.Where(x => x.Status == PublicationStatus.Draft).OrderByDescending(x => x.VersionNumber).FirstOrDefault();
        return Ok(new { pageId = page?.Id, key, draft });
    }

    [HttpPut("{key}/draft")]
    public async Task<IActionResult> SaveDraft(string key, ContentDraftRequest request, CancellationToken cancellationToken)
    {
        var json = request.Content.GetRawText();
        if (json.Length > 250_000 || request.Content.ValueKind is not JsonValueKind.Object) throw new DomainException("El contenido debe ser un objeto JSON de hasta 250 KB.");
        var normalizedKey = key.Trim().ToLowerInvariant();
        if (normalizedKey == "home") ValidateHomeContent(request.Content);
        var page = await db.ContentPages.Include(x => x.Versions).SingleOrDefaultAsync(x => x.Key == normalizedKey, cancellationToken);
        if (page is null)
        {
            page = new ContentPage(key, key.Equals("home", StringComparison.OrdinalIgnoreCase) ? "Página principal" : key);
            db.ContentPages.Add(page);
        }
        var userId = CurrentUserId();
        var version = page.CreateDraft(json, userId);
        db.AuditLogs.Add(AuditLogFactory.Create(User, HttpContext, configuration, "ContentDraftSaved", "ContentPage", page.Id.ToString(), new { page.Key, version.VersionNumber }));
        await db.SaveChangesAsync(cancellationToken);
        return Ok(new { pageId = page.Id, versionId = version.Id, version.VersionNumber, version.Status });
    }

    [HttpPost("{key}/publish")]
    public async Task<IActionResult> Publish(string key, ContentPublishRequest request, CancellationToken cancellationToken)
    {
        var normalizedKey = key.Trim().ToLowerInvariant();
        var page = await db.ContentPages.Include(x => x.Versions).SingleOrDefaultAsync(x => x.Key == normalizedKey, cancellationToken) ?? throw new KeyNotFoundException();
        var version = page.Versions.SingleOrDefault(x => x.Id == request.VersionId) ?? throw new KeyNotFoundException();
        page.Publish(version, CurrentUserId(), request.Note, DateTimeOffset.UtcNow);
        db.AuditLogs.Add(AuditLogFactory.Create(User, HttpContext, configuration, "ContentPublished", "ContentPage", page.Id.ToString(), new { page.Key, version.VersionNumber, request.Note }));
        await db.SaveChangesAsync(cancellationToken);
        return Ok(new { page.Id, page.CurrentPublishedVersionId, version.PublishedAt });
    }

    [HttpGet("{key}/versions")]
    public async Task<IActionResult> Versions(string key, CancellationToken cancellationToken)
    {
        var normalizedKey = key.Trim().ToLowerInvariant();
        return Ok(await db.ContentPageVersions.AsNoTracking().Where(x => x.ContentPageId == db.ContentPages.Where(p => p.Key == normalizedKey).Select(p => p.Id).FirstOrDefault()).OrderByDescending(x => x.VersionNumber).Select(x => new { x.Id, x.VersionNumber, x.Status, x.CreatedByUserId, x.PublishedByUserId, x.PublishedAt, x.PublicationNote }).ToListAsync(cancellationToken));
    }

    private Guid CurrentUserId() => Guid.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier), out var id) ? id : throw new UnauthorizedAccessException();

    private static void ValidateHomeContent(JsonElement content)
    {
        EnsureProperties(content, ["announcement", "announcementLink", "announcementActive", "hero", "carousel", "featured", "story", "benefits", "categories"]);
        PlainTextOptional(content, "announcement", 200);
        PlainTextOptional(content, "announcementLink", 200);

        if (content.TryGetProperty("hero", out var hero) && hero.ValueKind == JsonValueKind.Object)
        {
            EnsureProperties(hero, ["eyebrow", "title", "accent", "description", "ctaLabel", "ctaLink", "imageUrl", "imageAlt"]);
            PlainTextOptional(hero, "eyebrow", 120);
            PlainTextOptional(hero, "title", 120);
            PlainTextOptional(hero, "accent", 120);
            PlainTextOptional(hero, "description", 500);
            PlainTextOptional(hero, "ctaLabel", 60);
            PlainTextOptional(hero, "ctaLink", 200);
            PlainTextOptional(hero, "imageUrl", 500);
            PlainTextOptional(hero, "imageAlt", 200);
        }

        if (content.TryGetProperty("carousel", out var carousel) && carousel.ValueKind == JsonValueKind.Array)
        {
            if (carousel.GetArrayLength() > 12) throw new DomainException("El carrusel no puede tener más de 12 diapositivas.");
            foreach (var slide in carousel.EnumerateArray())
            {
                if (slide.ValueKind != JsonValueKind.Object) throw new DomainException("Cada diapositiva del carrusel debe ser un objeto.");
                EnsureProperties(slide, ["id", "eyebrow", "title", "accent", "description", "ctaLabel", "ctaLink", "imageUrl", "imageAlt", "isActive"]);
                PlainTextOptional(slide, "id", 60);
                PlainTextOptional(slide, "eyebrow", 120);
                PlainTextOptional(slide, "title", 120);
                PlainTextOptional(slide, "accent", 120);
                PlainTextOptional(slide, "description", 500);
                PlainTextOptional(slide, "ctaLabel", 60);
                PlainTextOptional(slide, "ctaLink", 200);
                PlainTextOptional(slide, "imageUrl", 500);
                PlainTextOptional(slide, "imageAlt", 200);
            }
        }

        if (content.TryGetProperty("featured", out var featured) && featured.ValueKind == JsonValueKind.Object)
        {
            EnsureProperties(featured, ["eyebrow", "heading", "productIds", "autoSelect", "collectionId"]);
            PlainTextOptional(featured, "eyebrow", 120);
            PlainTextOptional(featured, "heading", 150);
            if (featured.TryGetProperty("productIds", out var pids) && pids.ValueKind == JsonValueKind.Array)
            {
                if (pids.GetArrayLength() > 24) throw new DomainException("No puedes seleccionar más de 24 productos destacados.");
                foreach (var pid in pids.EnumerateArray())
                {
                    if (pid.ValueKind != JsonValueKind.String || (pid.GetString()?.Length ?? 0) > 60)
                        throw new DomainException("Identificador de producto inválido en destacados.");
                }
            }
        }

        if (content.TryGetProperty("story", out var story) && story.ValueKind == JsonValueKind.Object)
        {
            EnsureProperties(story, ["eyebrow", "heading", "description", "imageUrl", "imageAlt", "ctaLabel", "ctaLink", "stats"]);
            PlainTextOptional(story, "eyebrow", 120);
            PlainTextOptional(story, "heading", 160);
            PlainTextOptional(story, "description", 1000);
            PlainTextOptional(story, "imageUrl", 500);
            PlainTextOptional(story, "imageAlt", 200);
            PlainTextOptional(story, "ctaLabel", 60);
            PlainTextOptional(story, "ctaLink", 200);
            if (story.TryGetProperty("stats", out var stats) && stats.ValueKind == JsonValueKind.Array)
            {
                if (stats.GetArrayLength() > 6) throw new DomainException("Máximo 6 contadores estadísticos en historia.");
                foreach (var stat in stats.EnumerateArray())
                {
                    if (stat.ValueKind != JsonValueKind.Object) throw new DomainException("Cada estadística debe ser un objeto.");
                    EnsureProperties(stat, ["number", "label"]);
                    PlainTextOptional(stat, "number", 40);
                    PlainTextOptional(stat, "label", 80);
                }
            }
        }

        if (content.TryGetProperty("benefits", out var benefits) && benefits.ValueKind == JsonValueKind.Array)
        {
            if (benefits.GetArrayLength() > 6) throw new DomainException("Máximo 6 beneficios de compra.");
            foreach (var b in benefits.EnumerateArray())
            {
                if (b.ValueKind != JsonValueKind.Object) throw new DomainException("Cada beneficio debe ser un objeto.");
                EnsureProperties(b, ["title", "description", "icon"]);
                PlainTextOptional(b, "title", 80);
                PlainTextOptional(b, "description", 160);
                PlainTextOptional(b, "icon", 40);
            }
        }

        if (content.TryGetProperty("categories", out var categories) && categories.ValueKind == JsonValueKind.Array)
        {
            if (categories.GetArrayLength() > 8) throw new DomainException("Máximo 8 categorías destacadas.");
            foreach (var cat in categories.EnumerateArray())
            {
                if (cat.ValueKind != JsonValueKind.Object) throw new DomainException("Cada categoría debe ser un objeto.");
                EnsureProperties(cat, ["label", "link", "imageUrl", "imageAlt"]);
                PlainTextOptional(cat, "label", 80);
                PlainTextOptional(cat, "link", 200);
                PlainTextOptional(cat, "imageUrl", 500);
                PlainTextOptional(cat, "imageAlt", 200);
            }
        }
    }

    private static void PlainTextOptional(JsonElement parent, string name, int maximum)
    {
        if (!parent.TryGetProperty(name, out var value)) return;
        if (value.ValueKind == JsonValueKind.Null) return;
        if (value.ValueKind != JsonValueKind.String) throw new DomainException($"El campo {name} debe ser una cadena de texto.");
        var str = value.GetString() ?? string.Empty;
        if (str.Length > maximum || str.IndexOfAny(['<', '>']) >= 0)
            throw new DomainException($"El campo {name} debe ser texto plano de hasta {maximum} caracteres sin caracteres de formato.");
    }

    private static void EnsureProperties(JsonElement element, IReadOnlyCollection<string> allowed)
    {
        if (element.EnumerateObject().Any(property => !allowed.Contains(property.Name, StringComparer.Ordinal))) throw new DomainException("El contenido incluye campos no permitidos.");
    }
}

[ApiController]
[Route("api/v1/content")]
public sealed class ContentController(StoreDbContext db) : ControllerBase
{
    [HttpGet("{key}")]
    [ResponseCache(Duration = 60, Location = ResponseCacheLocation.Any)]
    public async Task<IActionResult> Published(string key, CancellationToken cancellationToken)
    {
        var normalizedKey = key.Trim().ToLowerInvariant();
        var page = await db.ContentPages.AsNoTracking().SingleOrDefaultAsync(x => x.Key == normalizedKey, cancellationToken);
        if (page?.CurrentPublishedVersionId is null) return NotFound();
        var version = await db.ContentPageVersions.AsNoTracking().SingleOrDefaultAsync(x => x.Id == page.CurrentPublishedVersionId, cancellationToken);
        if (version is null) return NotFound();
        return Content(version.ContentJson, "application/json");
    }
}

[ApiController]
[Authorize(Roles = "Admin")]
[Route("api/v1/admin/audit")]
public sealed class AdminAuditController(StoreDbContext db) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> List([FromQuery] string? resourceType, CancellationToken cancellationToken)
    {
        var query = db.AuditLogs.AsNoTracking().AsQueryable();
        if (!string.IsNullOrWhiteSpace(resourceType)) query = query.Where(x => x.ResourceType == resourceType);
        return Ok(await query.OrderByDescending(x => x.CreatedAt).Take(500).Select(x => new { x.Id, x.UserId, x.Action, x.ResourceType, x.ResourceId, x.ChangesJson, x.RequestId, x.CreatedAt }).ToListAsync(cancellationToken));
    }
}
