using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Store.Domain.Common;
using Store.Infrastructure.Persistence;

namespace Store.Api.Controllers;

[ApiController]
[Authorize(Policy = "OrderWrite")]
[Route("api/v1/admin/customers")]
public sealed class AdminCustomersController(StoreDbContext db) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> List([FromQuery] string? search, CancellationToken cancellationToken)
    {
        var usersQuery = db.Users.AsNoTracking().AsQueryable();
        if (!string.IsNullOrWhiteSpace(search))
        {
            var term = search.Trim();
            usersQuery = usersQuery.Where(u =>
                (u.Email != null && EF.Functions.ILike(u.Email, $"%{term}%")) ||
                EF.Functions.ILike(u.FirstName, $"%{term}%") ||
                EF.Functions.ILike(u.LastName, $"%{term}%"));
        }

        var users = await usersQuery.OrderByDescending(u => u.CreatedAt).Take(200).ToListAsync(cancellationToken);
        var userEmails = users.Where(u => !string.IsNullOrEmpty(u.Email)).Select(u => u.Email!.ToLowerInvariant()).ToList();
        var userIds = users.Select(u => (Guid?)u.Id).ToList();

        // Get orders for these users
        var orders = await db.Orders.AsNoTracking()
            .Where(o => userIds.Contains(o.UserId) || userEmails.Contains(o.CustomerEmail))
            .Select(o => new { o.Id, o.UserId, o.CustomerEmail, o.TotalClp, o.Status, o.PaidAt, o.CreatedAt })
            .ToListAsync(cancellationToken);

        var result = users.Select(u =>
        {
            var email = u.Email?.ToLowerInvariant() ?? string.Empty;
            var userOrders = orders.Where(o => o.UserId == u.Id || (!string.IsNullOrEmpty(email) && string.Equals(o.CustomerEmail, email, StringComparison.OrdinalIgnoreCase))).ToList();
            var validOrders = userOrders.Where(o => o.PaidAt != null || (o.Status != OrderStatus.Cancelled && o.Status != OrderStatus.PaymentFailed)).ToList();
            return new
            {
                u.Id,
                Email = u.Email ?? string.Empty,
                u.FirstName,
                u.LastName,
                IsRegistered = true,
                u.MarketingConsent,
                u.MarketingConsentAt,
                u.CreatedAt,
                OrdersCount = userOrders.Count,
                TotalSpentClp = validOrders.Sum(o => o.TotalClp),
                LastOrderAt = userOrders.OrderByDescending(o => o.CreatedAt).Select(o => (DateTimeOffset?)o.CreatedAt).FirstOrDefault()
            };
        }).ToList();

        // Also include guest buyers if search applies or on general list
        var guestOrdersQuery = db.Orders.AsNoTracking().Where(o => o.UserId == null);
        if (!string.IsNullOrWhiteSpace(search))
        {
            var term = search.Trim();
            guestOrdersQuery = guestOrdersQuery.Where(o =>
                EF.Functions.ILike(o.CustomerEmail, $"%{term}%") ||
                db.OrderAddresses.Any(a => a.OrderId == o.Id && EF.Functions.ILike(a.RecipientName, $"%{term}%")));
        }

        var guestOrders = await guestOrdersQuery
            .OrderByDescending(o => o.CreatedAt)
            .Take(300)
            .Select(o => new { o.Id, o.CustomerEmail, o.TotalClp, o.Status, o.PaidAt, o.CreatedAt })
            .ToListAsync(cancellationToken);

        var guestGroups = guestOrders
            .GroupBy(o => o.CustomerEmail, StringComparer.OrdinalIgnoreCase)
            .Where(g => !userEmails.Contains(g.Key, StringComparer.OrdinalIgnoreCase))
            .Take(100)
            .ToList();

        var latestOrderIds = guestGroups.Select(g => g.OrderByDescending(o => o.CreatedAt).First().Id).ToList();
        var addresses = await db.OrderAddresses.AsNoTracking()
            .Where(a => latestOrderIds.Contains(a.OrderId))
            .ToDictionaryAsync(a => a.OrderId, cancellationToken);

        foreach (var g in guestGroups)
        {
            var latest = g.OrderByDescending(o => o.CreatedAt).First();
            addresses.TryGetValue(latest.Id, out var addr);
            var validGuestOrders = g.Where(o => o.PaidAt != null || (o.Status != OrderStatus.Cancelled && o.Status != OrderStatus.PaymentFailed)).ToList();
            result.Add(new
            {
                Id = latest.Id,
                Email = g.Key,
                FirstName = addr?.RecipientName ?? "Invitado",
                LastName = string.Empty,
                IsRegistered = false,
                MarketingConsent = false,
                MarketingConsentAt = (DateTimeOffset?)null,
                CreatedAt = g.Min(o => o.CreatedAt),
                OrdersCount = g.Count(),
                TotalSpentClp = validGuestOrders.Sum(o => o.TotalClp),
                LastOrderAt = (DateTimeOffset?)latest.CreatedAt
            });
        }

        return Ok(result.OrderByDescending(r => r.LastOrderAt ?? r.CreatedAt));
    }

    [HttpGet("{id:guid}")]
    public async Task<IActionResult> Get(Guid id, CancellationToken cancellationToken)
    {
        var user = await db.Users.AsNoTracking().SingleOrDefaultAsync(u => u.Id == id, cancellationToken);
        if (user is not null)
        {
            var email = user.Email?.ToLowerInvariant() ?? string.Empty;
            var addresses = await db.Addresses.AsNoTracking()
                .Where(a => a.UserId == id)
                .OrderByDescending(a => a.IsDefault)
                .ToListAsync(cancellationToken);

            var orders = await db.Orders.AsNoTracking()
                .Where(o => o.UserId == id || (!string.IsNullOrEmpty(email) && o.CustomerEmail == email))
                .OrderByDescending(o => o.CreatedAt)
                .Select(o => new { o.Id, o.Number, o.Status, o.TotalClp, o.PaidAt, o.CreatedAt, itemsCount = o.Items.Sum(i => i.Quantity) })
                .ToListAsync(cancellationToken);

            var validOrders = orders.Where(o => o.PaidAt != null || o.Status != OrderStatus.Cancelled).ToList();

            return Ok(new
            {
                user.Id,
                Email = user.Email ?? string.Empty,
                user.FirstName,
                user.LastName,
                user.PhoneNumber,
                IsRegistered = true,
                user.MarketingConsent,
                user.MarketingConsentAt,
                user.CreatedAt,
                user.LastLoginAt,
                Addresses = addresses.Select(a => new
                {
                    a.Id,
                    a.Label,
                    a.RecipientName,
                    a.Phone,
                    a.Region,
                    a.Commune,
                    a.AddressLine1,
                    a.AddressLine2,
                    a.Instructions,
                    a.IsDefault
                }),
                Orders = orders,
                Metrics = new
                {
                    OrdersCount = orders.Count,
                    TotalSpentClp = validOrders.Sum(o => o.TotalClp),
                    AverageOrderValueClp = validOrders.Count > 0 ? validOrders.Sum(o => o.TotalClp) / validOrders.Count : 0
                }
            });
        }

        // Check if ID is a guest reference from an order
        var order = await db.Orders.AsNoTracking().Include(o => o.Items).SingleOrDefaultAsync(o => o.Id == id, cancellationToken);
        if (order is not null)
        {
            var email = order.CustomerEmail;
            var guestOrders = await db.Orders.AsNoTracking()
                .Where(o => o.CustomerEmail == email)
                .OrderByDescending(o => o.CreatedAt)
                .Select(o => new { o.Id, o.Number, o.Status, o.TotalClp, o.PaidAt, o.CreatedAt, itemsCount = o.Items.Sum(i => i.Quantity) })
                .ToListAsync(cancellationToken);

            var address = await db.OrderAddresses.AsNoTracking().SingleOrDefaultAsync(a => a.OrderId == order.Id, cancellationToken);
            var validOrders = guestOrders.Where(o => o.PaidAt != null || o.Status != OrderStatus.Cancelled).ToList();

            return Ok(new
            {
                Id = order.Id,
                Email = order.CustomerEmail,
                FirstName = address?.RecipientName ?? "Invitado",
                LastName = string.Empty,
                PhoneNumber = address?.Phone ?? string.Empty,
                IsRegistered = false,
                MarketingConsent = false,
                MarketingConsentAt = (DateTimeOffset?)null,
                CreatedAt = guestOrders.Min(o => o.CreatedAt),
                LastLoginAt = (DateTimeOffset?)null,
                Addresses = address is not null ? new[]
                {
                    new
                    {
                        Id = address.Id,
                        Label = "Dirección de despacho",
                        RecipientName = address.RecipientName,
                        Phone = address.Phone,
                        Region = address.Region,
                        Commune = address.Commune,
                        AddressLine1 = address.AddressLine1,
                        AddressLine2 = address.AddressLine2,
                        Instructions = address.Instructions,
                        IsDefault = true
                    }
                } : Array.Empty<object>(),
                Orders = guestOrders,
                Metrics = new
                {
                    OrdersCount = guestOrders.Count,
                    TotalSpentClp = validOrders.Sum(o => o.TotalClp),
                    AverageOrderValueClp = validOrders.Count > 0 ? validOrders.Sum(o => o.TotalClp) / validOrders.Count : 0
                }
            });
        }

        return NotFound();
    }
}
