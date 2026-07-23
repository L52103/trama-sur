using Microsoft.AspNetCore.Mvc;
using Store.Application.Payments;
using Store.Domain.Common;
using Store.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;

namespace Store.Api.Controllers;

[ApiController]
[Route("api/v1/payments")]
public sealed class PaymentsController(IPaymentService payments, IConfiguration configuration, StoreDbContext db, IWebHostEnvironment environment) : ControllerBase
{
    [HttpPost("webpay/create")]
    public async Task<ActionResult<PaymentRedirectDto>> Create(CreatePaymentRequest request, CancellationToken cancellationToken)
    {
        if (!Request.Headers.TryGetValue("Idempotency-Key", out var header) || header.Count != 1 || header[0] != request.IdempotencyKey)
            throw new DomainException("Se requiere una clave de idempotencia consistente.");
        if (!await CanAccessOrderAsync(request.OrderId, cancellationToken)) return Forbid();
        return await payments.CreateWebpayAsync(request, cancellationToken);
    }

    [AcceptVerbs("GET", "POST")]
    [Route("webpay/return")]
    public async Task<IActionResult> Return([FromQuery(Name = "token_ws")] string? queryToken, [FromForm(Name = "token_ws")] string? formToken, CancellationToken cancellationToken)
    {
        var token = queryToken ?? formToken;
        var publicUrl = configuration["App:PublicUrl"]?.TrimEnd('/') ?? "http://localhost:4200";
        if (string.IsNullOrWhiteSpace(token)) return Redirect($"{publicUrl}/pago/resultado?status=cancelled");
        var result = await payments.CommitWebpayAsync(token, cancellationToken);
        return Redirect($"{publicUrl}/pago/resultado?order={result.OrderId}&status={(result.Authorized ? "authorized" : "rejected")}");
    }

    [HttpGet("{orderId:guid}/status")]
    public async Task<ActionResult<PaymentResultDto>> Status(Guid orderId, CancellationToken cancellationToken)
    {
        if (!await CanAccessOrderAsync(orderId, cancellationToken)) return NotFound();
        var status = await payments.GetStatusAsync(orderId, cancellationToken);
        return status is null ? NotFound() : Ok(status);
    }

    private async Task<bool> CanAccessOrderAsync(Guid orderId, CancellationToken cancellationToken)
    {
        var order = await db.Orders.AsNoTracking().Where(x => x.Id == orderId).Select(x => new { x.UserId, x.SourceCartId }).SingleOrDefaultAsync(cancellationToken);
        if (order is null) return false;
        if (order.UserId.HasValue && Guid.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier), out var userId) && order.UserId == userId) return true;
        var cookieName = environment.IsDevelopment() ? "trama_cart" : "__Host-trama_cart";
        if (!order.SourceCartId.HasValue || !Request.Cookies.TryGetValue(cookieName, out var token) || string.IsNullOrWhiteSpace(token)) return false;
        var hash = Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(token)));
        return await db.Carts.AsNoTracking().AnyAsync(x => x.Id == order.SourceCartId && x.GuestTokenHash == hash, cancellationToken);
    }
}
