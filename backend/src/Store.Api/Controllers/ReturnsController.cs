using System.Text.Json;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Store.Api.Infrastructure;
using Store.Domain.Commerce;
using Store.Domain.Common;
using Store.Domain.Operations;
using Store.Infrastructure.Persistence;

namespace Store.Api.Controllers;

public sealed record ReturnLineRequest(Guid OrderItemId, int Quantity);
public sealed record CreateReturnRequest(string OrderNumber, string Email, string Reason, string CustomerNotes, IReadOnlyList<ReturnLineRequest> Items);
public sealed record UpdateReturnRequest(ReturnStatus Status, string ResolutionNote);

[ApiController]
[Route("api/v1/returns")]
public sealed class ReturnsController(StoreDbContext db) : ControllerBase
{
    [HttpPost]
    public async Task<IActionResult> Create(CreateReturnRequest request, CancellationToken cancellationToken)
    {
        var normalizedEmail = request.Email.Trim().ToLowerInvariant();
        var order = await db.Orders.Include(x => x.Items).SingleOrDefaultAsync(x => x.Number == request.OrderNumber && x.CustomerEmail == normalizedEmail, cancellationToken);
        if (order is null || order.Status is not (OrderStatus.Delivered or OrderStatus.Shipped)) throw new DomainException("No pudimos validar un pedido elegible con esos datos.");
        var lines = new List<ReturnItem>();
        foreach (var itemRequest in request.Items)
        {
            var orderItem = order.Items.SingleOrDefault(x => x.Id == itemRequest.OrderItemId);
            if (orderItem is null || itemRequest.Quantity > orderItem.Quantity) throw new DomainException("La selección de artículos no es válida.");
            lines.Add(new ReturnItem(itemRequest.OrderItemId, itemRequest.Quantity));
        }
        var returnRequest = new ReturnRequest(order.Id, request.Reason, request.CustomerNotes, lines);
        db.Returns.Add(returnRequest);
        if (order.Status == OrderStatus.Delivered) order.TransitionTo(OrderStatus.ReturnRequested, DateTimeOffset.UtcNow);
        db.OutboxMessages.Add(new OutboxMessage("ReturnRequested", JsonSerializer.Serialize(new { Email = order.CustomerEmail, order.Number, ReturnId = returnRequest.Id }), DateTimeOffset.UtcNow));
        await db.SaveChangesAsync(cancellationToken);
        return Accepted(new { returnRequest.Id, returnRequest.Status, message = "Recibimos tu solicitud y enviaremos una confirmación por correo." });
    }
}

[ApiController]
[Authorize(Policy = "OrderWrite")]
[Route("api/v1/admin/returns")]
public sealed class AdminReturnsController(StoreDbContext db, IConfiguration configuration) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> List(CancellationToken cancellationToken) => Ok(await db.Returns.AsNoTracking().Include(x => x.Items).Join(db.Orders, r => r.OrderId, o => o.Id, (r, o) => new { r.Id, r.OrderId, o.Number, o.CustomerEmail, r.Status, r.Reason, r.CustomerNotes, items = r.Items.Count, r.CreatedAt }).OrderByDescending(x => x.CreatedAt).Take(300).ToListAsync(cancellationToken));

    [HttpPut("{id:guid}")]
    public async Task<IActionResult> Update(Guid id, UpdateReturnRequest request, CancellationToken cancellationToken)
    {
        var result = await db.Returns.SingleOrDefaultAsync(x => x.Id == id, cancellationToken) ?? throw new KeyNotFoundException();
        var previous = result.Status;
        result.SetStatus(request.Status, DateTimeOffset.UtcNow);
        db.AuditLogs.Add(AuditLogFactory.Create(User, HttpContext, configuration, "ReturnStatusChanged", "ReturnRequest", id.ToString(), new { From = previous, To = request.Status, request.ResolutionNote }));
        await db.SaveChangesAsync(cancellationToken);
        return NoContent();
    }
}
