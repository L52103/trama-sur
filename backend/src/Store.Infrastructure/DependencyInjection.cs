using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;
using Store.Application.Cart;
using Store.Application.Catalog;
using Store.Application.Checkout;
using Store.Application.Payments;
using Store.Infrastructure.Identity;
using Store.Infrastructure.Payments;
using Store.Infrastructure.Persistence;
using Store.Infrastructure.Services;

namespace Store.Infrastructure;

public static class DependencyInjection
{
    public static IServiceCollection AddInfrastructure(this IServiceCollection services, IConfiguration configuration)
    {
        var connectionString = configuration.GetConnectionString("DefaultConnection")
            ?? throw new InvalidOperationException("Falta ConnectionStrings:DefaultConnection.");

        services.AddDbContext<StoreDbContext>(options => options.UseNpgsql(connectionString, npgsql =>
        {
            // Transactional operations fail atomically and are retried by the caller with
            // an idempotency key. Provider-level retries are intentionally disabled: EF
            // cannot safely replay user-managed transactions without recreating the full
            // DbContext/unit of work, and an unsafe replay could duplicate commerce data.
            npgsql.CommandTimeout(30);
        }));

        services.AddIdentityCore<ApplicationUser>(options =>
        {
            options.User.RequireUniqueEmail = true;
            options.SignIn.RequireConfirmedEmail = true;
            options.Password.RequiredLength = 12;
            options.Password.RequireDigit = true;
            options.Password.RequireLowercase = true;
            options.Password.RequireUppercase = true;
            options.Password.RequireNonAlphanumeric = true;
            options.Lockout.AllowedForNewUsers = true;
            options.Lockout.MaxFailedAccessAttempts = 5;
            options.Lockout.DefaultLockoutTimeSpan = TimeSpan.FromMinutes(15);
        }).AddRoles<IdentityRole<Guid>>().AddEntityFrameworkStores<StoreDbContext>().AddSignInManager().AddDefaultTokenProviders();

        services.AddDataProtection().SetApplicationName("TramaSur.Store");
        services.Configure<WebpayOptions>(configuration.GetSection(WebpayOptions.SectionName));
        services.AddHttpClient<IWebpayGateway, WebpayGateway>((provider, client) =>
        {
            var options = provider.GetRequiredService<IOptions<WebpayOptions>>().Value;
            var production = string.Equals(options.Environment, "Production", StringComparison.OrdinalIgnoreCase);
            client.BaseAddress = new Uri(production
                ? "https://webpay3g.transbank.cl/rswebpaytransaction/api/webpay/v1.2/"
                : "https://webpay3gint.transbank.cl/rswebpaytransaction/api/webpay/v1.2/");
            client.Timeout = TimeSpan.FromSeconds(15);
        });

        services.AddScoped<IProductCatalog, ProductCatalog>();
        services.AddScoped<ICartService, CartService>();
        services.AddScoped<ICheckoutService, CheckoutService>();
        services.AddScoped<IPaymentService, PaymentService>();
        services.AddHostedService<ReservationExpiryWorker>();
        services.Configure<ResendOptions>(configuration.GetSection(ResendOptions.SectionName));
        services.AddHttpClient<ITransactionalEmailSender, ResendEmailSender>(client =>
        {
            client.BaseAddress = new Uri("https://api.resend.com/");
            client.Timeout = TimeSpan.FromSeconds(15);
        });
        services.AddHostedService<OutboxWorker>();
        services.Configure<SupabaseStorageOptions>(configuration.GetSection(SupabaseStorageOptions.SectionName));
        services.AddHttpClient<IMediaStorage, SupabaseMediaStorage>((provider, client) =>
        {
            var options = provider.GetRequiredService<IOptions<SupabaseStorageOptions>>().Value;
            client.BaseAddress = Uri.TryCreate(options.Url.TrimEnd('/') + "/", UriKind.Absolute, out var uri) ? uri : new Uri("http://localhost/");
            client.Timeout = TimeSpan.FromSeconds(30);
        });
        services.AddHealthChecks().AddDbContextCheck<StoreDbContext>("postgres", tags: ["ready"]);
        return services;
    }
}
