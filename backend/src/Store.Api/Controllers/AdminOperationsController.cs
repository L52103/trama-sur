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
        if (json.Length > 100_000 || request.Content.ValueKind is not JsonValueKind.Object) throw new DomainException("El contenido debe ser un objeto JSON de hasta 100 KB.");
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
        EnsureProperties(content, ["announcement", "hero", "featured", "story"]);
        PlainText(content, "announcement", 160);
        var hero = Object(content, "hero");
        EnsureProperties(hero, ["eyebrow", "title", "accent", "description", "ctaLabel"]);
        PlainText(hero, "eyebrow", 80); PlainText(hero, "title", 80); PlainText(hero, "accent", 80); PlainText(hero, "description", 300); PlainText(hero, "ctaLabel", 40);
        var featured = Object(content, "featured");
        EnsureProperties(featured, ["eyebrow", "heading"]);
        PlainText(featured, "eyebrow", 80); PlainText(featured, "heading", 100);
        var story = Object(content, "story");
        EnsureProperties(story, ["eyebrow", "heading", "description"]);
        PlainText(story, "eyebrow", 80); PlainText(story, "heading", 120); PlainText(story, "description", 500);
    }

    private static JsonElement Object(JsonElement parent, string name) => parent.TryGetProperty(name, out var value) && value.ValueKind == JsonValueKind.Object ? value : throw new DomainException($"El bloque {name} no es válido.");
    private static void PlainText(JsonElement parent, string name, int maximum)
    {
        if (!parent.TryGetProperty(name, out var value) || value.ValueKind != JsonValueKind.String || string.IsNullOrWhiteSpace(value.GetString()) || value.GetString()!.Length > maximum || value.GetString()!.IndexOfAny(['<', '>']) >= 0) throw new DomainException($"El campo {name} debe ser texto plano de hasta {maximum} caracteres.");
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
        var version = await db.ContentPageVersions.AsNoTracking().SingleAsync(x => x.Id == page.CurrentPublishedVersionId, cancellationToken);
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
