using FluentValidation;
using Microsoft.AspNetCore.Mvc;
using Store.Application.Checkout;
using Store.Domain.Common;
using System.Security.Claims;

namespace Store.Api.Controllers;

public sealed record CheckoutQuoteApiRequest(ShippingAddressRequest ShippingAddress, string? CouponCode);
public sealed record CreateOrderApiRequest(ShippingAddressRequest ShippingAddress, string? CouponCode, bool AcceptedTerms, bool MarketingConsent, string IdempotencyKey);

[ApiController]
[Route("api/v1/checkout")]
public sealed class CheckoutController(ICheckoutService checkout, IValidator<CreateOrderRequest> createOrderValidator, IValidator<ShippingAddressRequest> addressValidator, IWebHostEnvironment environment) : ControllerBase
{
    [HttpPost("quote")]
    public async Task<CheckoutQuoteDto> Quote(CheckoutQuoteApiRequest request, CancellationToken cancellationToken)
    {
        await addressValidator.ValidateAndThrowAsync(request.ShippingAddress, cancellationToken);
        return await checkout.QuoteAsync(new CheckoutQuoteRequest(ReadCartToken(), request.ShippingAddress, request.CouponCode), cancellationToken);
    }

    [HttpPost("create-order")]
    public async Task<ActionResult<CreateOrderDto>> CreateOrder(CreateOrderApiRequest request, CancellationToken cancellationToken)
    {
        var userId = Guid.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier), out var parsed) ? parsed : null as Guid?;
        var command = new CreateOrderRequest(ReadCartToken(), request.ShippingAddress, request.CouponCode, request.AcceptedTerms, request.MarketingConsent, request.IdempotencyKey, userId);
        await createOrderValidator.ValidateAndThrowAsync(command, cancellationToken);
        return StatusCode(StatusCodes.Status201Created, await checkout.CreateOrderAsync(command, cancellationToken));
    }

    private string ReadCartToken()
    {
        var name = environment.IsDevelopment() ? "trama_cart" : "__Host-trama_cart";
        return Request.Cookies.TryGetValue(name, out var token) && !string.IsNullOrWhiteSpace(token)
            ? token
            : throw new DomainException("La bolsa no existe o expiró.");
    }
}
