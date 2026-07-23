using System.Text;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;
using Store.Domain.Catalog;
using Store.Domain.Commerce;
using Store.Domain.Operations;
using Store.Domain.Entities;
using Store.Infrastructure.Identity;

namespace Store.Infrastructure.Persistence;

public sealed class StoreDbContext(DbContextOptions<StoreDbContext> options)
    : IdentityDbContext<ApplicationUser, IdentityRole<Guid>, Guid>(options)
{
    public DbSet<RefreshToken> RefreshTokens => Set<RefreshToken>();
    public DbSet<Address> Addresses => Set<Address>();
    public DbSet<WishlistItem> WishlistItems => Set<WishlistItem>();
    public DbSet<Category> Categories => Set<Category>();
    public DbSet<Product> Products => Set<Product>();
    public DbSet<ProductVariant> ProductVariants => Set<ProductVariant>();
    public DbSet<ProductImage> ProductImages => Set<ProductImage>();
    public DbSet<FunctionalFeature> FunctionalAttributes => Set<FunctionalFeature>();
    public DbSet<ProductFunctionalFeature> ProductFunctionalAttributes => Set<ProductFunctionalFeature>();
    public DbSet<ProductGroup> Collections => Set<ProductGroup>();
    public DbSet<ProductCollectionItem> ProductCollectionItems => Set<ProductCollectionItem>();
    public DbSet<Promotion> Promotions => Set<Promotion>();
    public DbSet<PromotionRedemption> PromotionRedemptions => Set<PromotionRedemption>();
    public DbSet<Warehouse> Warehouses => Set<Warehouse>();
    public DbSet<InventoryItem> InventoryItems => Set<InventoryItem>();
    public DbSet<InventoryMovement> InventoryMovements => Set<InventoryMovement>();
    public DbSet<StockReservation> StockReservations => Set<StockReservation>();
    public DbSet<StockReservationItem> StockReservationItems => Set<StockReservationItem>();
    public DbSet<Cart> Carts => Set<Cart>();
    public DbSet<CartItem> CartItems => Set<CartItem>();
    public DbSet<Order> Orders => Set<Order>();
    public DbSet<OrderItem> OrderItems => Set<OrderItem>();
    public DbSet<OrderAddress> OrderAddresses => Set<OrderAddress>();
    public DbSet<OrderStatusHistory> OrderStatusHistory => Set<OrderStatusHistory>();
    public DbSet<PaymentTransaction> PaymentTransactions => Set<PaymentTransaction>();
    public DbSet<ReturnRequest> Returns => Set<ReturnRequest>();
    public DbSet<ReturnItem> ReturnItems => Set<ReturnItem>();
    public DbSet<OutboxMessage> OutboxMessages => Set<OutboxMessage>();
    public DbSet<IdempotencyKey> IdempotencyKeys => Set<IdempotencyKey>();
    public DbSet<AuditLog> AuditLogs => Set<AuditLog>();
    public DbSet<ContentPage> ContentPages => Set<ContentPage>();
    public DbSet<ContentPageVersion> ContentPageVersions => Set<ContentPageVersion>();
    public DbSet<MediaAsset> MediaAssets => Set<MediaAsset>();
    public DbSet<StoreSetting> StoreSettings => Set<StoreSetting>();

    protected override void OnModelCreating(ModelBuilder builder)
    {
        base.OnModelCreating(builder);

        builder.Entity<ApplicationUser>(entity =>
        {
            entity.ToTable("users");
            entity.HasIndex(x => x.NormalizedEmail).IsUnique();
            entity.Property(x => x.FirstName).HasMaxLength(80);
            entity.Property(x => x.LastName).HasMaxLength(80);
        });
        builder.Entity<IdentityRole<Guid>>().ToTable("roles");
        builder.Entity<IdentityUserRole<Guid>>().ToTable("user_roles");
        builder.Entity<IdentityUserClaim<Guid>>().ToTable("user_claims");
        builder.Entity<IdentityUserLogin<Guid>>().ToTable("user_logins");
        builder.Entity<IdentityRoleClaim<Guid>>().ToTable("role_claims");
        builder.Entity<IdentityUserToken<Guid>>().ToTable("user_tokens");

        builder.Entity<RefreshToken>(entity =>
        {
            entity.HasKey(x => x.Id);
            entity.HasIndex(x => x.TokenHash).IsUnique();
            entity.HasIndex(x => new { x.UserId, x.FamilyId });
            entity.Property(x => x.TokenHash).HasMaxLength(128);
        });
        builder.Entity<Address>(entity =>
        {
            entity.HasKey(x => x.Id);
            entity.HasIndex(x => x.UserId);
            entity.Property(x => x.Label).HasMaxLength(80);
            entity.Property(x => x.RecipientName).HasMaxLength(160);
            entity.Property(x => x.Phone).HasMaxLength(30);
        });
        builder.Entity<WishlistItem>(entity =>
        {
            entity.ToTable("wishlist_items");
            entity.HasKey(x => x.Id);
            entity.HasIndex(x => new { x.UserId, x.VariantId }).IsUnique();
            entity.HasIndex(x => x.VariantId);
            entity.HasOne(x => x.User).WithMany().HasForeignKey(x => x.UserId).OnDelete(DeleteBehavior.Cascade);
            entity.HasOne<ProductVariant>().WithMany().HasForeignKey(x => x.VariantId).OnDelete(DeleteBehavior.Cascade);
        });

        builder.Entity<Category>(entity =>
        {
            entity.HasIndex(x => x.Slug).IsUnique();
            entity.Property(x => x.Name).HasMaxLength(120);
            entity.Property(x => x.Slug).HasMaxLength(140);
        });
        builder.Entity<Product>(entity =>
        {
            entity.HasIndex(x => x.Slug).IsUnique();
            entity.HasIndex(x => new { x.Status, x.PublishedAt });
            entity.Property(x => x.Name).HasMaxLength(180);
            entity.Property(x => x.Slug).HasMaxLength(200);
            entity.Property(x => x.Status).HasConversion<string>().HasMaxLength(30);
            entity.Property(x => x.Currency).HasMaxLength(3);
            entity.HasMany(x => x.Variants).WithOne(x => x.Product).HasForeignKey(x => x.ProductId);
            entity.HasMany(x => x.Images).WithOne().HasForeignKey(x => x.ProductId);
            entity.HasMany(x => x.FunctionalAttributes).WithOne().HasForeignKey(x => x.ProductId);
        });
        builder.Entity<ProductVariant>(entity =>
        {
            entity.HasIndex(x => x.Sku).IsUnique();
            entity.HasIndex(x => new { x.ProductId, x.Color, x.Size }).IsUnique();
            entity.Property(x => x.Sku).HasMaxLength(80);
            entity.Property(x => x.Color).HasMaxLength(80);
            entity.Property(x => x.Size).HasMaxLength(30);
        });
        builder.Entity<ProductImage>(entity =>
        {
            entity.HasIndex(x => new { x.ProductId, x.DisplayOrder });
            entity.Property(x => x.Url).HasMaxLength(1000);
            entity.Property(x => x.AltText).HasMaxLength(240);
        });
        builder.Entity<FunctionalFeature>(entity => entity.HasIndex(x => x.Slug).IsUnique());
        builder.Entity<ProductFunctionalFeature>(entity =>
        {
            entity.HasIndex(x => new { x.ProductId, x.FunctionalAttributeId }).IsUnique();
            entity.HasOne(x => x.Attribute).WithMany().HasForeignKey(x => x.FunctionalAttributeId);
        });
        builder.Entity<ProductGroup>(entity =>
        {
            entity.HasIndex(x => x.Slug).IsUnique();
            entity.HasMany(x => x.Items).WithOne().HasForeignKey(x => x.CollectionId).OnDelete(DeleteBehavior.Cascade);
        });
        builder.Entity<ProductCollectionItem>(entity =>
        {
            entity.HasIndex(x => new { x.CollectionId, x.ProductId }).IsUnique();
            entity.HasIndex(x => x.ProductId);
            entity.HasOne<Product>().WithMany().HasForeignKey(x => x.ProductId).OnDelete(DeleteBehavior.Restrict);
        });
        builder.Entity<Promotion>(entity =>
        {
            entity.HasIndex(x => x.Code).IsUnique();
            entity.HasIndex(x => new { x.IsActive, x.StartsAt, x.EndsAt });
            entity.Property(x => x.Type).HasConversion<string>().HasMaxLength(30);
        });
        builder.Entity<PromotionRedemption>(entity =>
        {
            entity.HasIndex(x => new { x.PromotionId, x.Status });
            entity.HasIndex(x => new { x.PromotionId, x.CustomerEmailHash, x.Status });
            entity.HasIndex(x => x.OrderId).IsUnique();
            entity.Property(x => x.Status).HasConversion<string>().HasMaxLength(30);
            entity.HasOne<Promotion>().WithMany().HasForeignKey(x => x.PromotionId).OnDelete(DeleteBehavior.Restrict);
            entity.HasOne<Order>().WithMany().HasForeignKey(x => x.OrderId).OnDelete(DeleteBehavior.Restrict);
        });

        builder.Entity<Warehouse>(entity => entity.HasIndex(x => x.Code).IsUnique());
        builder.Entity<InventoryItem>(entity =>
        {
            entity.HasIndex(x => new { x.WarehouseId, x.VariantId }).IsUnique();
            entity.HasIndex(x => x.VariantId);
            // PostgreSQL exposes xmin as a server-generated transaction id. Mapping the
            // concurrency token to that system column avoids an application-managed xid
            // column that would be NULL on inserts and gives us optimistic concurrency.
            entity.Property(x => x.RowVersion).HasColumnName("xmin").IsRowVersion();
            entity.ToTable(t => t.HasCheckConstraint("ck_inventory_non_negative", "on_hand >= 0 AND reserved >= 0 AND reserved <= on_hand"));
        });
        builder.Entity<InventoryMovement>(entity =>
        {
            entity.HasIndex(x => new { x.InventoryItemId, x.CreatedAt });
            entity.Property(x => x.Type).HasConversion<string>().HasMaxLength(40);
        });
        builder.Entity<StockReservation>(entity =>
        {
            entity.HasIndex(x => x.OrderId).IsUnique();
            entity.HasIndex(x => new { x.Status, x.ExpiresAt });
            entity.Property(x => x.Status).HasConversion<string>().HasMaxLength(30);
            entity.HasMany(x => x.Items).WithOne().HasForeignKey(x => x.StockReservationId);
        });
        builder.Entity<StockReservationItem>(entity => entity.HasIndex(x => x.InventoryItemId));

        builder.Entity<Cart>(entity =>
        {
            entity.HasIndex(x => x.GuestTokenHash).IsUnique();
            entity.HasIndex(x => x.UserId).IsUnique().HasFilter("user_id IS NOT NULL");
            entity.HasMany(x => x.Items).WithOne().HasForeignKey(x => x.CartId).OnDelete(DeleteBehavior.Cascade);
        });
        builder.Entity<CartItem>(entity => entity.HasIndex(x => new { x.CartId, x.VariantId }).IsUnique());
        builder.Entity<Order>(entity =>
        {
            entity.HasIndex(x => x.Number).IsUnique();
            entity.HasIndex(x => new { x.UserId, x.CreatedAt });
            entity.HasIndex(x => x.SourceCartId);
            entity.HasIndex(x => new { x.Status, x.CreatedAt });
            entity.Property(x => x.Status).HasConversion<string>().HasMaxLength(30);
            entity.Property(x => x.Currency).HasMaxLength(3);
            entity.HasMany(x => x.Items).WithOne().HasForeignKey(x => x.OrderId);
            entity.HasMany(x => x.History).WithOne().HasForeignKey(x => x.OrderId);
        });
        builder.Entity<OrderItem>(entity => entity.HasIndex(x => x.VariantId));
        builder.Entity<OrderAddress>(entity => entity.HasIndex(x => x.OrderId));
        builder.Entity<OrderStatusHistory>(entity =>
        {
            entity.HasIndex(x => new { x.OrderId, x.CreatedAt });
            entity.Property(x => x.FromStatus).HasConversion<string>().HasMaxLength(30);
            entity.Property(x => x.ToStatus).HasConversion<string>().HasMaxLength(30);
        });
        builder.Entity<PaymentTransaction>(entity =>
        {
            entity.HasIndex(x => x.ProviderTransactionId).IsUnique().HasFilter("provider_transaction_id <> ''");
            entity.HasIndex(x => x.ProviderTokenHash).IsUnique().HasFilter("provider_token_hash <> ''");
            entity.HasIndex(x => x.IdempotencyKey).IsUnique();
            entity.HasIndex(x => new { x.OrderId, x.Status });
            entity.Property(x => x.Status).HasConversion<string>().HasMaxLength(30);
        });
        builder.Entity<ReturnRequest>(entity =>
        {
            entity.HasIndex(x => new { x.OrderId, x.CreatedAt });
            entity.Property(x => x.Status).HasConversion<string>().HasMaxLength(30);
            entity.HasMany(x => x.Items).WithOne().HasForeignKey(x => x.ReturnRequestId);
        });

        builder.Entity<OutboxMessage>(entity => entity.HasIndex(x => new { x.Status, x.AvailableAt }));
        builder.Entity<IdempotencyKey>(entity =>
        {
            entity.HasIndex(x => new { x.Scope, x.KeyHash }).IsUnique();
            entity.HasIndex(x => x.ExpiresAt);
        });
        builder.Entity<AuditLog>(entity =>
        {
            entity.HasIndex(x => new { x.ResourceType, x.ResourceId, x.CreatedAt });
            entity.HasIndex(x => new { x.UserId, x.CreatedAt });
        });
        builder.Entity<ContentPage>(entity =>
        {
            entity.HasIndex(x => x.Key).IsUnique();
            entity.HasMany(x => x.Versions).WithOne().HasForeignKey(x => x.ContentPageId);
        });
        builder.Entity<ContentPageVersion>(entity =>
        {
            entity.HasIndex(x => new { x.ContentPageId, x.VersionNumber }).IsUnique();
            entity.Property(x => x.ContentJson).HasColumnType("jsonb");
            entity.Property(x => x.Status).HasConversion<string>().HasMaxLength(30);
        });
        builder.Entity<MediaAsset>(entity =>
        {
            entity.HasIndex(x => x.StorageKey).IsUnique();
            entity.HasIndex(x => new { x.IsDeleted, x.CreatedAt });
            entity.HasIndex(x => x.ChecksumSha256);
        });

        builder.Entity<StoreSetting>(entity =>
        {
            entity.HasKey(x => x.Key);
            entity.Property(x => x.Key).HasMaxLength(100);
        });

        ApplySnakeCaseNames(builder);
    }

    private static void ApplySnakeCaseNames(ModelBuilder builder)
    {
        foreach (var entity in builder.Model.GetEntityTypes())
        {
            entity.SetTableName(ToSnakeCase(entity.GetTableName() ?? entity.ClrType.Name));
            foreach (var property in entity.GetProperties())
            {
                // Preserve PostgreSQL's system concurrency column. The general naming
                // convention must not turn this explicit mapping back into row_version.
                property.SetColumnName(entity.ClrType == typeof(InventoryItem) && property.Name == nameof(InventoryItem.RowVersion)
                    ? "xmin"
                    : ToSnakeCase(property.Name));
            }
            foreach (var key in entity.GetKeys()) key.SetName(ToSnakeCase(key.GetName() ?? $"pk_{entity.GetTableName()}"));
            foreach (var foreignKey in entity.GetForeignKeys()) foreignKey.SetConstraintName(ToSnakeCase(foreignKey.GetConstraintName() ?? $"fk_{entity.GetTableName()}"));
            foreach (var index in entity.GetIndexes()) index.SetDatabaseName(ToSnakeCase(index.GetDatabaseName() ?? $"ix_{entity.GetTableName()}"));
        }
    }

    private static string ToSnakeCase(string value)
    {
        var builder = new StringBuilder(value.Length + 8);
        for (var i = 0; i < value.Length; i++)
        {
            var character = value[i];
            if (char.IsUpper(character) && i > 0 && value[i - 1] != '_') builder.Append('_');
            builder.Append(char.ToLowerInvariant(character));
        }
        return builder.ToString();
    }
}
