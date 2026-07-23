using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Store.Domain.Common;
using Store.Infrastructure.Identity;
using Store.Infrastructure.Persistence;

namespace Store.Api.Controllers;

public sealed record UpdateProfileRequest(string FirstName, string LastName, bool MarketingConsent);
public sealed record AddressRequest(string Label, string RecipientName, string Phone, string Region, string Commune, string AddressLine1, string? AddressLine2, string? Instructions, bool IsDefault);
public sealed record WishlistRequest(Guid VariantId);

[ApiController]
[Authorize]
[Route("api/v1/me")]
public sealed class CustomerController(StoreDbContext db, UserManager<ApplicationUser> userManager) : ControllerBase
{
    [HttpGet("profile")]
    public async Task<IActionResult> Profile() => Ok(await db.Users.AsNoTracking().Where(x => x.Id == UserId()).Select(x => new { x.Id, x.Email, x.FirstName, x.LastName, x.MarketingConsent, x.MarketingConsentAt, x.CreatedAt }).SingleAsync());

    [HttpPut("profile")]
    public async Task<IActionResult> UpdateProfile(UpdateProfileRequest request, CancellationToken cancellationToken)
    {
        var user = await userManager.FindByIdAsync(UserId().ToString()) ?? throw new UnauthorizedAccessException();
        user.FirstName = Required(request.FirstName, 80);
        user.LastName = Required(request.LastName, 80);
        if (request.MarketingConsent != user.MarketingConsent)
        {
            user.MarketingConsent = request.MarketingConsent;
            user.MarketingConsentAt = request.MarketingConsent ? DateTimeOffset.UtcNow : null;
        }
        await db.SaveChangesAsync(cancellationToken);
        return NoContent();
    }

    [HttpGet("addresses")]
    public async Task<IActionResult> Addresses(CancellationToken cancellationToken) => Ok(await db.Addresses.AsNoTracking().Where(x => x.UserId == UserId()).OrderByDescending(x => x.IsDefault).ThenBy(x => x.CreatedAt).ToListAsync(cancellationToken));

    [HttpPost("addresses")]
    public async Task<IActionResult> AddAddress(AddressRequest request, CancellationToken cancellationToken)
    {
        var address = BuildAddress(request, UserId());
        if (request.IsDefault) await ClearDefaultAsync(cancellationToken);
        db.Addresses.Add(address);
        await db.SaveChangesAsync(cancellationToken);
        return Created($"/api/v1/me/addresses/{address.Id}", address);
    }

    [HttpPut("addresses/{id:guid}")]
    public async Task<IActionResult> UpdateAddress(Guid id, AddressRequest request, CancellationToken cancellationToken)
    {
        var address = await db.Addresses.SingleOrDefaultAsync(x => x.Id == id && x.UserId == UserId(), cancellationToken) ?? throw new KeyNotFoundException();
        if (request.IsDefault) await ClearDefaultAsync(cancellationToken);
        address.Label = Required(request.Label, 80); address.RecipientName = Required(request.RecipientName, 160); address.Phone = Required(request.Phone, 30); address.Region = Required(request.Region, 100); address.Commune = Required(request.Commune, 100); address.AddressLine1 = Required(request.AddressLine1, 180); address.AddressLine2 = request.AddressLine2; address.Instructions = request.Instructions; address.IsDefault = request.IsDefault; address.UpdatedAt = DateTimeOffset.UtcNow;
        await db.SaveChangesAsync(cancellationToken);
        return NoContent();
    }

    [HttpDelete("addresses/{id:guid}")]
    public async Task<IActionResult> DeleteAddress(Guid id, CancellationToken cancellationToken)
    {
        var address = await db.Addresses.SingleOrDefaultAsync(x => x.Id == id && x.UserId == UserId(), cancellationToken) ?? throw new KeyNotFoundException();
        db.Addresses.Remove(address);
        await db.SaveChangesAsync(cancellationToken);
        return NoContent();
    }

    [HttpGet("orders")]
    public async Task<IActionResult> Orders(CancellationToken cancellationToken) => Ok(await db.Orders.AsNoTracking().Where(x => x.UserId == UserId()).OrderByDescending(x => x.CreatedAt).Select(x => new { x.Id, x.Number, x.Status, x.TotalClp, x.Currency, x.PaidAt, x.CreatedAt, items = x.Items.Select(i => new { i.Id, i.ProductName, i.Color, i.Size, i.Quantity, i.LineTotalClp }) }).ToListAsync(cancellationToken));

    [HttpGet("orders/{id:guid}")]
    public async Task<IActionResult> Order(Guid id, CancellationToken cancellationToken)
    {
        var order = await db.Orders.AsNoTracking().Include(x => x.Items).Include(x => x.History).SingleOrDefaultAsync(x => x.Id == id && x.UserId == UserId(), cancellationToken);
        return order is null ? NotFound() : Ok(order);
    }

    [HttpGet("wishlist")]
    public async Task<IActionResult> Wishlist(CancellationToken cancellationToken) => Ok(await db.WishlistItems.AsNoTracking().Where(x => x.UserId == UserId()).Join(db.ProductVariants.Include(x => x.Product), w => w.VariantId, v => v.Id, (w, v) => new { w.VariantId, w.CreatedAt, v.Sku, v.Color, v.Size, productId = v.ProductId, productName = v.Product!.Name, slug = v.Product.Slug }).ToListAsync(cancellationToken));

    [HttpPost("wishlist/items")]
    public async Task<IActionResult> AddWishlist(WishlistRequest request, CancellationToken cancellationToken)
    {
        if (!await db.ProductVariants.AnyAsync(x => x.Id == request.VariantId && x.IsActive, cancellationToken)) throw new KeyNotFoundException();
        if (!await db.WishlistItems.AnyAsync(x => x.UserId == UserId() && x.VariantId == request.VariantId, cancellationToken)) db.WishlistItems.Add(new WishlistItem { UserId = UserId(), VariantId = request.VariantId });
        await db.SaveChangesAsync(cancellationToken);
        return NoContent();
    }

    [HttpDelete("wishlist/items/{variantId:guid}")]
    public async Task<IActionResult> RemoveWishlist(Guid variantId, CancellationToken cancellationToken)
    {
        var item = await db.WishlistItems.SingleOrDefaultAsync(x => x.UserId == UserId() && x.VariantId == variantId, cancellationToken) ?? throw new KeyNotFoundException();
        db.WishlistItems.Remove(item);
        await db.SaveChangesAsync(cancellationToken);
        return NoContent();
    }

    private Guid UserId() => Guid.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier), out var id) ? id : throw new UnauthorizedAccessException();
    private async Task ClearDefaultAsync(CancellationToken cancellationToken) => await db.Addresses.Where(x => x.UserId == UserId() && x.IsDefault).ExecuteUpdateAsync(setters => setters.SetProperty(x => x.IsDefault, false).SetProperty(x => x.UpdatedAt, DateTimeOffset.UtcNow), cancellationToken);
    private static string Required(string value, int max) => string.IsNullOrWhiteSpace(value) || value.Length > max ? throw new DomainException("Un campo obligatorio no es válido.") : value.Trim();
    private static Address BuildAddress(AddressRequest request, Guid userId) => new() { UserId = userId, Label = Required(request.Label, 80), RecipientName = Required(request.RecipientName, 160), Phone = Required(request.Phone, 30), Region = Required(request.Region, 100), Commune = Required(request.Commune, 100), AddressLine1 = Required(request.AddressLine1, 180), AddressLine2 = request.AddressLine2, Instructions = request.Instructions, IsDefault = request.IsDefault };
}
