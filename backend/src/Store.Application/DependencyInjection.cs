using FluentValidation;
using Microsoft.Extensions.DependencyInjection;
using Store.Application.Checkout;

namespace Store.Application;

public static class DependencyInjection
{
    public static IServiceCollection AddApplication(this IServiceCollection services)
    {
        services.AddValidatorsFromAssemblyContaining<ShippingAddressValidator>();
        return services;
    }
}
