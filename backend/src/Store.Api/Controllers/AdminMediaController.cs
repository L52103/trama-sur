using System.Security.Claims;
using System.Security.Cryptography;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Store.Api.Infrastructure;
using Store.Domain.Common;
using Store.Domain.Operations;
using Store.Infrastructure.Persistence;
using Store.Infrastructure.Services;

namespace Store.Api.Controllers;

[ApiController]
[Authorize(Policy = "CatalogWrite")]
[Route("api/v1/admin/media")]
public sealed class AdminMediaController(StoreDbContext db, IMediaStorage storage, IConfiguration configuration) : ControllerBase
{
    private const int MaxBytes = 8 * 1024 * 1024;
    private static readonly Dictionary<string, (string Extension, byte[][] Signatures)> Allowed = new(StringComparer.OrdinalIgnoreCase)
    {
        ["image/png"] = ("png", [[0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]]),
        ["image/jpeg"] = ("jpg", [[0xFF, 0xD8, 0xFF]]),
        ["image/webp"] = ("webp", [[0x52, 0x49, 0x46, 0x46]])
    };

    [HttpGet]
    public async Task<IActionResult> List(CancellationToken cancellationToken) => Ok(await db.MediaAssets.AsNoTracking().Where(x => !x.IsDeleted).OrderByDescending(x => x.CreatedAt).Take(500).Select(x => new { x.Id, x.PublicUrl, x.ContentType, x.SizeBytes, x.AltText, x.CreatedAt }).ToListAsync(cancellationToken));

    [HttpPost]
    [RequestSizeLimit(MaxBytes)]
    public async Task<IActionResult> Upload([FromForm] IFormFile file, [FromForm] string altText, CancellationToken cancellationToken)
    {
        if (file.Length is <= 0 or > MaxBytes || !Allowed.TryGetValue(file.ContentType, out var mediaType)) throw new DomainException("La imagen debe ser PNG, JPG o WebP y pesar hasta 8 MB.");
        await using var memory = new MemoryStream((int)file.Length);
        await file.CopyToAsync(memory, cancellationToken);
        var bytes = memory.ToArray();
        if (!ValidSignature(file.ContentType, bytes)) throw new DomainException("El contenido del archivo no coincide con el tipo declarado.");
        if (file.ContentType.Equals("image/webp", StringComparison.OrdinalIgnoreCase) && (bytes.Length < 12 || !bytes.AsSpan(8, 4).SequenceEqual("WEBP"u8))) throw new DomainException("El archivo WebP no es válido.");
        var checksum = Convert.ToHexString(SHA256.HashData(bytes));
        var existing = await db.MediaAssets.AsNoTracking().FirstOrDefaultAsync(x => x.ChecksumSha256 == checksum && !x.IsDeleted, cancellationToken);
        if (existing is not null) return Ok(new { existing.Id, existing.PublicUrl, existing.AltText, duplicate = true });

        var key = $"catalog/{DateTimeOffset.UtcNow:yyyy/MM}/{Guid.CreateVersion7():N}.{mediaType.Extension}";
        memory.Position = 0;
        var stored = await storage.UploadAsync(key, memory, file.ContentType, cancellationToken);
        var userId = Guid.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier), out var parsed) ? parsed : throw new UnauthorizedAccessException();
        var asset = new MediaAsset(stored.StorageKey, stored.PublicUrl, file.ContentType, file.Length, checksum, altText, userId);
        db.MediaAssets.Add(asset);
        db.AuditLogs.Add(AuditLogFactory.Create(User, HttpContext, configuration, "MediaUploaded", "MediaAsset", asset.Id.ToString(), new { asset.StorageKey, asset.ContentType, asset.SizeBytes, asset.ChecksumSha256 }));
        await db.SaveChangesAsync(cancellationToken);
        return Created($"/api/v1/admin/media/{asset.Id}", new { asset.Id, asset.PublicUrl, asset.AltText });
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken cancellationToken)
    {
        var asset = await db.MediaAssets.SingleOrDefaultAsync(x => x.Id == id && !x.IsDeleted, cancellationToken) ?? throw new KeyNotFoundException();
        var inProduct = await db.ProductImages.AnyAsync(x => x.Url == asset.PublicUrl, cancellationToken);
        var inContent = await db.ContentPageVersions.AnyAsync(x => x.ContentJson.Contains(asset.PublicUrl), cancellationToken);
        if (inProduct || inContent) throw new DomainException("La imagen está siendo usada por contenido o productos. Retírala antes de eliminarla.");
        await storage.DeleteAsync(asset.StorageKey, cancellationToken);
        asset.MarkDeleted(DateTimeOffset.UtcNow);
        db.AuditLogs.Add(AuditLogFactory.Create(User, HttpContext, configuration, "MediaDeleted", "MediaAsset", asset.Id.ToString(), new { asset.StorageKey }));
        await db.SaveChangesAsync(cancellationToken);
        return NoContent();
    }

    private static bool ValidSignature(string contentType, byte[] bytes)
    {
        var signatures = Allowed[contentType].Signatures;
        return signatures.Any(signature => bytes.Length >= signature.Length && bytes.AsSpan(0, signature.Length).SequenceEqual(signature));
    }
}
