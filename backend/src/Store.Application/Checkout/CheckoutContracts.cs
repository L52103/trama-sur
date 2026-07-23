using FluentValidation;

namespace Store.Application.Checkout;

public sealed record ShippingAddressRequest(string FirstName, string LastName, string Email, string Phone, string Region, string Commune, string AddressLine1, string? AddressLine2, string? Instructions);
public sealed record CheckoutQuoteRequest(string CartToken, ShippingAddressRequest ShippingAddress, string? CouponCode);
public sealed record CheckoutQuoteDto(long SubtotalClp, long DiscountClp, long ShippingClp, long TotalClp, string Currency, string ShippingMethod, string DeliveryEstimate, IReadOnlyList<string> AppliedPromotions);
public sealed record CreateOrderRequest(string CartToken, ShippingAddressRequest ShippingAddress, string? CouponCode, bool AcceptedTerms, bool MarketingConsent, string IdempotencyKey, Guid? UserId = null);
public sealed record CreateOrderDto(Guid OrderId, string OrderNumber, long TotalClp, string Currency, string PaymentStatus);

public interface ICheckoutService
{
    Task<CheckoutQuoteDto> QuoteAsync(CheckoutQuoteRequest request, CancellationToken cancellationToken);
    Task<CreateOrderDto> CreateOrderAsync(CreateOrderRequest request, CancellationToken cancellationToken);
}

public sealed class ShippingAddressValidator : AbstractValidator<ShippingAddressRequest>
{
    public ShippingAddressValidator()
    {
        RuleFor(x => x.FirstName).NotEmpty().MaximumLength(80);
        RuleFor(x => x.LastName).NotEmpty().MaximumLength(80);
        RuleFor(x => x.Email).NotEmpty().EmailAddress().MaximumLength(254);
        RuleFor(x => x.Phone).Matches(@"^\+?56\s?\d{8,9}$").WithMessage("Ingresa un teléfono chileno válido.");
        RuleFor(x => x.Region).NotEmpty().MaximumLength(100);
        RuleFor(x => x.Commune).NotEmpty().MaximumLength(100);
        RuleFor(x => x.AddressLine1).NotEmpty().MaximumLength(180);
        RuleFor(x => x.AddressLine2).MaximumLength(120);
        RuleFor(x => x.Instructions).MaximumLength(240);
    }
}

public sealed class CreateOrderValidator : AbstractValidator<CreateOrderRequest>
{
    public CreateOrderValidator()
    {
        RuleFor(x => x.CartToken).NotEmpty().MaximumLength(200);
        RuleFor(x => x.ShippingAddress).NotNull().SetValidator(new ShippingAddressValidator());
        RuleFor(x => x.AcceptedTerms).Equal(true).WithMessage("Debes aceptar los términos para continuar.");
        RuleFor(x => x.IdempotencyKey).NotEmpty().MaximumLength(100);
    }
}
