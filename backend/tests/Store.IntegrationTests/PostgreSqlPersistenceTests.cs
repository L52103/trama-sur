using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Npgsql;
using Store.Application.Cart;
using Store.Application.Checkout;
using Store.Infrastructure;
using Store.Infrastructure.Persistence;
using Xunit.Sdk;

namespace Store.IntegrationTests;

public sealed class PostgreSqlPersistenceTests
{
    [Fact]
    public async Task Migrations_and_seed_create_a_complete_catalog_with_server_generated_concurrency_tokens()
    {
        var connectionString = Environment.GetEnvironmentVariable("TRAMA_TEST_CONNECTION");
        if (string.IsNullOrWhiteSpace(connectionString))
        {
            throw SkipException.ForSkip("TRAMA_TEST_CONNECTION is required for PostgreSQL integration tests.");
        }

        var connection = new NpgsqlConnectionStringBuilder(connectionString);
        Assert.Contains("test", connection.Database, StringComparison.OrdinalIgnoreCase);

        var options = new DbContextOptionsBuilder<StoreDbContext>()
            .UseNpgsql(connectionString)
            .Options;

        await using (var resetConnection = new NpgsqlConnection(connectionString))
        {
            await resetConnection.OpenAsync();
            await using var reset = resetConnection.CreateCommand();
            reset.CommandText = "DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public AUTHORIZATION CURRENT_USER;";
            await reset.ExecuteNonQueryAsync();
        }

        await using var db = new StoreDbContext(options);
        await db.Database.MigrateAsync();
        await StoreDbContextSeed.SeedAsync(db, CancellationToken.None);

        Assert.Equal(20, await db.Products.CountAsync());
        Assert.Equal(195, await db.ProductVariants.CountAsync());
        Assert.Equal(195, await db.InventoryItems.CountAsync());

        var inventory = await db.InventoryItems.AsNoTracking().FirstAsync();
        Assert.NotEqual(0u, inventory.RowVersion);

        var variantId = await db.ProductVariants.Select(x => x.Id).FirstAsync();
        var configuration = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["ConnectionStrings:DefaultConnection"] = connectionString,
                ["Transbank:Environment"] = "Integration",
            })
            .Build();
        var services = new ServiceCollection();
        services.AddLogging();
        services.AddInfrastructure(configuration);
        await using var provider = services.BuildServiceProvider();
        await using var scope = provider.CreateAsyncScope();
        var cart = scope.ServiceProvider.GetRequiredService<ICartService>();
        var checkout = scope.ServiceProvider.GetRequiredService<ICheckoutService>();
        const string cartToken = "integration-test-cart-token-with-sufficient-entropy-2026";
        await cart.AddAsync(cartToken, new AddCartItemRequest(variantId, 1), CancellationToken.None);

        var request = new CreateOrderRequest(
            cartToken,
            new ShippingAddressRequest("Compra", "Prueba", "checkout@example.com", "+56912345678", "Metropolitana de Santiago", "Santiago", "Avenida Prueba 123", null, null),
            null,
            true,
            false,
            "integration-checkout-idempotency-key");
        var created = await checkout.CreateOrderAsync(request, CancellationToken.None);
        var repeated = await checkout.CreateOrderAsync(request, CancellationToken.None);

        Assert.Equal(created, repeated);
        Assert.Equal("PendingPayment", created.PaymentStatus);
        Assert.Equal(1, await db.StockReservations.CountAsync());
        Assert.Equal(1, await db.Orders.CountAsync());
        Assert.Empty((await cart.GetAsync(cartToken, CancellationToken.None)).Items);
    }
}
