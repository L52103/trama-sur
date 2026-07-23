using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Store.Domain.Common;
using Store.Infrastructure.Persistence;

namespace Store.Api.Controllers;

[ApiController]
[Authorize(Policy = "CatalogRead")]
[Route("api/v1/admin/analytics")]
public sealed class AdminAnalyticsController(StoreDbContext db) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> GetAnalytics(CancellationToken cancellationToken)
    {
        var totalProducts = await db.Products.CountAsync(cancellationToken);
        
        var lowStockItems = await (
            from i in db.InventoryItems
            join v in db.ProductVariants on i.VariantId equals v.Id
            join p in db.Products on v.ProductId equals p.Id
            where i.OnHand - i.Reserved <= v.LowStockThreshold
            select new {
                i.Id,
                ProductName = p.Name,
                v.Sku,
                v.Color,
                v.Size,
                Available = i.OnHand - i.Reserved,
                v.LowStockThreshold
            }
        ).Take(10).ToListAsync(cancellationToken);

        var totalOrders = await db.Orders.CountAsync(cancellationToken);
        var totalRevenue = await db.Orders
            .Where(o => o.Status != OrderStatus.Cancelled && o.Status != OrderStatus.PaymentFailed && o.Status != OrderStatus.Expired)
            .SumAsync(o => (long?)o.TotalClp, cancellationToken) ?? 0;

        var audienceBreakdown = await db.Products
            .GroupBy(p => p.Audience)
            .Select(g => new { Audience = g.Key, Count = g.Count() })
            .ToListAsync(cancellationToken);

        return Ok(new
        {
            TotalProducts = totalProducts,
            LowStockCount = lowStockItems.Count,
            LowStockItems = lowStockItems,
            TotalOrders = totalOrders,
            TotalRevenueClp = totalRevenue,
            AverageOrderValueClp = totalOrders > 0 ? totalRevenue / totalOrders : 0,
            AudienceBreakdown = audienceBreakdown
        });
    }
}
