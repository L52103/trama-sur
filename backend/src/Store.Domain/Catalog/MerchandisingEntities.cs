using Store.Domain.Common;

namespace Store.Domain.Catalog;

public sealed class ProductGroup : Entity
{
    private readonly List<ProductCollectionItem> _items = [];
    private ProductGroup() { }
    public ProductGroup(string name, string slug, string description)
    {
        Name = Guard.Required(name, nameof(name), 160);
        Slug = Guard.Required(slug, nameof(slug), 180).ToLowerInvariant();
        Description = Guard.Required(description, nameof(description), 1000);
    }
    public string Name { get; private set; } = string.Empty;
    public string Slug { get; private set; } = string.Empty;
    public string Description { get; private set; } = string.Empty;
    public bool IsVisible { get; private set; }
    public int DisplayOrder { get; private set; }
    public IReadOnlyCollection<ProductCollectionItem> Items => _items;
    public void Update(string name, string description, bool isVisible, int displayOrder, DateTimeOffset now)
    {
        Name = Guard.Required(name, nameof(name), 160);
        Description = Guard.Required(description, nameof(description), 1000);
        IsVisible = isVisible;
        DisplayOrder = displayOrder;
        Touch(now);
    }
    public void AddProduct(Guid productId, int displayOrder)
    {
        if (_items.Any(x => x.ProductId == productId)) return;
        _items.Add(new ProductCollectionItem(Id, productId, displayOrder));
    }
}

public sealed class ProductCollectionItem : Entity
{
    private ProductCollectionItem() { }
    public ProductCollectionItem(Guid collectionId, Guid productId, int displayOrder)
    {
        CollectionId = collectionId;
        ProductId = productId;
        DisplayOrder = displayOrder;
    }
    public Guid CollectionId { get; private set; }
    public Guid ProductId { get; private set; }
    public int DisplayOrder { get; private set; }
}

public sealed class Promotion : Entity
{
    private Promotion() { }
    public Promotion(string name, string code, PromotionType type, long value, long minimumOrderClp, DateTimeOffset startsAt, DateTimeOffset endsAt, int? totalUsageLimit, int? perCustomerLimit)
    {
        Name = Guard.Required(name, nameof(name), 160);
        Code = Guard.Required(code, nameof(code), 60).ToUpperInvariant();
        Type = type;
        if (value <= 0 || type == PromotionType.Percentage && value > 100) throw new DomainException("El valor de la promoción no es válido.");
        Value = value;
        MinimumOrderClp = Guard.NonNegative(minimumOrderClp, nameof(minimumOrderClp));
        if (endsAt <= startsAt) throw new DomainException("La fecha de término debe ser posterior al inicio.");
        StartsAt = startsAt;
        EndsAt = endsAt;
        if (totalUsageLimit is <= 0 || perCustomerLimit is <= 0) throw new DomainException("Los límites de uso deben ser positivos.");
        TotalUsageLimit = totalUsageLimit;
        PerCustomerLimit = perCustomerLimit;
    }
    public string Name { get; private set; } = string.Empty;
    public string Code { get; private set; } = string.Empty;
    public PromotionType Type { get; private set; }
    public long Value { get; private set; }
    public long MinimumOrderClp { get; private set; }
    public DateTimeOffset StartsAt { get; private set; }
    public DateTimeOffset EndsAt { get; private set; }
    public int? TotalUsageLimit { get; private set; }
    public int? PerCustomerLimit { get; private set; }
    public bool IsActive { get; private set; } = true;
    public long CalculateDiscount(long subtotalClp, long shippingClp, DateTimeOffset now)
    {
        if (!IsActive || now < StartsAt || now >= EndsAt || subtotalClp < MinimumOrderClp) return 0;
        return Type switch
        {
            PromotionType.Percentage => checked(subtotalClp * Value / 100),
            PromotionType.FixedAmount => Math.Min(subtotalClp, Value),
            PromotionType.FreeShipping => shippingClp,
            _ => 0
        };
    }
    public void Deactivate(DateTimeOffset now) { IsActive = false; Touch(now); }
    public void Update(string name, PromotionType type, long value, long minimumOrderClp, DateTimeOffset startsAt, DateTimeOffset endsAt, int? totalUsageLimit, int? perCustomerLimit, bool isActive, DateTimeOffset now)
    {
        Name = Guard.Required(name, nameof(name), 160);
        if (value <= 0 || type == PromotionType.Percentage && value > 100) throw new DomainException("El valor de la promoción no es válido.");
        if (endsAt <= startsAt) throw new DomainException("La fecha de término debe ser posterior al inicio.");
        if (totalUsageLimit is <= 0 || perCustomerLimit is <= 0) throw new DomainException("Los límites de uso deben ser positivos.");
        Type = type;
        Value = value;
        MinimumOrderClp = Guard.NonNegative(minimumOrderClp, nameof(minimumOrderClp));
        StartsAt = startsAt;
        EndsAt = endsAt;
        TotalUsageLimit = totalUsageLimit;
        PerCustomerLimit = perCustomerLimit;
        IsActive = isActive;
        Touch(now);
    }
}

public sealed class PromotionRedemption : Entity
{
    private PromotionRedemption() { }
    public PromotionRedemption(Guid promotionId, Guid orderId, string customerEmail, long discountClp)
    {
        PromotionId = promotionId;
        OrderId = orderId;
        CustomerEmailHash = Convert.ToHexString(System.Security.Cryptography.SHA256.HashData(System.Text.Encoding.UTF8.GetBytes(customerEmail.Trim().ToLowerInvariant())));
        DiscountClp = Guard.NonNegative(discountClp, nameof(discountClp));
    }
    public Guid PromotionId { get; private set; }
    public Guid OrderId { get; private set; }
    public string CustomerEmailHash { get; private set; } = string.Empty;
    public long DiscountClp { get; private set; }
    public PromotionRedemptionStatus Status { get; private set; } = PromotionRedemptionStatus.Reserved;
    public void Commit(DateTimeOffset now) { if (Status == PromotionRedemptionStatus.Reserved) { Status = PromotionRedemptionStatus.Committed; Touch(now); } }
    public void Release(DateTimeOffset now) { if (Status == PromotionRedemptionStatus.Reserved) { Status = PromotionRedemptionStatus.Released; Touch(now); } }
}
