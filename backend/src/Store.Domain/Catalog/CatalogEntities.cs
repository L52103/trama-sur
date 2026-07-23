using Store.Domain.Common;

namespace Store.Domain.Catalog;

public sealed class Category : Entity
{
    private Category() { }

    public Category(string name, string slug)
    {
        Name = Guard.Required(name, nameof(name), 120);
        Slug = Guard.Required(slug, nameof(slug), 140).ToLowerInvariant();
    }

    public string Name { get; private set; } = string.Empty;
    public string Slug { get; private set; } = string.Empty;
    public string? Description { get; private set; }
    public int DisplayOrder { get; private set; }
    public bool IsVisible { get; private set; } = true;

    public void Update(string name, string? description, int displayOrder, bool isVisible, DateTimeOffset now)
    {
        Name = Guard.Required(name, nameof(name), 120);
        Description = description is null ? null : Guard.Required(description, nameof(description), 500);
        DisplayOrder = displayOrder;
        IsVisible = isVisible;
        Touch(now);
    }
}

public sealed class Product : Entity
{
    private readonly List<ProductVariant> _variants = [];
    private readonly List<ProductImage> _images = [];
    private readonly List<ProductFunctionalFeature> _functionalAttributes = [];

    private Product() { }

    public Product(string name, string slug, Guid categoryId, string shortDescription, long basePriceClp)
    {
        Name = Guard.Required(name, nameof(name), 180);
        Slug = Guard.Required(slug, nameof(slug), 200).ToLowerInvariant();
        CategoryId = categoryId;
        ShortDescription = Guard.Required(shortDescription, nameof(shortDescription), 280);
        BasePriceClp = Guard.NonNegative(basePriceClp, nameof(basePriceClp));
    }

    public string Name { get; private set; } = string.Empty;
    public string Slug { get; private set; } = string.Empty;
    public string ShortDescription { get; private set; } = string.Empty;
    public string Description { get; private set; } = string.Empty;
    public string Brand { get; private set; } = "TRAMA SUR";
    public string Audience { get; private set; } = "Unisex";
    public ProductStatus Status { get; private set; } = ProductStatus.Draft;
    public Guid CategoryId { get; private set; }
    public Category? Category { get; private set; }
    public long BasePriceClp { get; private set; }
    public long? CompareAtPriceClp { get; private set; }
    public string Currency { get; private set; } = "CLP";
    public string Materials { get; private set; } = string.Empty;
    public string CareInstructions { get; private set; } = string.Empty;
    public string? SizeGuideKey { get; private set; }
    public string MetaTitle { get; private set; } = string.Empty;
    public string MetaDescription { get; private set; } = string.Empty;
    public DateTimeOffset? PublishedAt { get; private set; }
    public DateTimeOffset? ArchivedAt { get; private set; }
    public IReadOnlyCollection<ProductVariant> Variants => _variants;
    public IReadOnlyCollection<ProductImage> Images => _images;
    public IReadOnlyCollection<ProductFunctionalFeature> FunctionalAttributes => _functionalAttributes;

    public void SetDetails(string description, string materials, string careInstructions, string audience, string metaTitle, string metaDescription)
    {
        Description = Guard.Required(description, nameof(description), 5000);
        Materials = Guard.Required(materials, nameof(materials), 1000);
        CareInstructions = Guard.Required(careInstructions, nameof(careInstructions), 1000);
        Audience = Guard.Required(audience, nameof(audience), 40);
        MetaTitle = Guard.Required(metaTitle, nameof(metaTitle), 70);
        MetaDescription = Guard.Required(metaDescription, nameof(metaDescription), 170);
    }

    public void AddVariant(ProductVariant variant) => _variants.Add(variant);
    public void RemoveVariant(ProductVariant variant) => _variants.Remove(variant);
    public void AddImage(ProductImage image)
    {
        if (image.IsPrimary && _images.Any(x => x.IsPrimary)) throw new DomainException("Solo puede existir una imagen principal.");
        _images.Add(image);
    }
    public void AddFunctionalAttribute(ProductFunctionalFeature attribute) => _functionalAttributes.Add(attribute);

    public void Publish(DateTimeOffset now)
    {
        if (_variants.All(x => !x.IsActive)) throw new DomainException("El producto necesita una variante activa.");
        if (_images.All(x => !x.IsPrimary)) throw new DomainException("El producto necesita una imagen principal.");
        Status = ProductStatus.Active;
        PublishedAt = now;
        Touch(now);
    }

    public void ChangePrice(long priceClp, long? compareAtPriceClp, DateTimeOffset now)
    {
        BasePriceClp = Guard.NonNegative(priceClp, nameof(priceClp));
        if (compareAtPriceClp is not null && compareAtPriceClp <= priceClp)
            throw new DomainException("El precio de comparación debe ser mayor al precio vigente.");
        CompareAtPriceClp = compareAtPriceClp;
        Touch(now);
    }

    public void UpdateBasics(string name, Guid categoryId, string shortDescription, long priceClp, long? compareAtPriceClp, DateTimeOffset now)
    {
        Name = Guard.Required(name, nameof(name), 180);
        CategoryId = categoryId;
        ShortDescription = Guard.Required(shortDescription, nameof(shortDescription), 280);
        ChangePrice(priceClp, compareAtPriceClp, now);
    }

    public void Archive(DateTimeOffset now)
    {
        Status = ProductStatus.Archived;
        ArchivedAt = now;
        Touch(now);
    }

    public void Unarchive(DateTimeOffset now)
    {
        Status = ProductStatus.Active;
        ArchivedAt = null;
        Touch(now);
    }
}

public sealed class ProductVariant : Entity
{
    private ProductVariant() { }

    public ProductVariant(Guid productId, string sku, string color, string size, long? priceClp = null)
    {
        ProductId = productId;
        Sku = Guard.Required(sku, nameof(sku), 80).ToUpperInvariant();
        Color = Guard.Required(color, nameof(color), 80);
        Size = Guard.Required(size, nameof(size), 30).ToUpperInvariant();
        PriceClp = priceClp is null ? null : Guard.NonNegative(priceClp.Value, nameof(priceClp));
    }

    public Guid ProductId { get; private set; }
    public Product? Product { get; private set; }
    public string Sku { get; private set; } = string.Empty;
    public string Color { get; private set; } = string.Empty;
    public string ColorHex { get; private set; } = "#151515";
    public string Size { get; private set; } = string.Empty;
    public string Cut { get; private set; } = "Regular";
    public string? Barcode { get; private set; }
    public long? PriceClp { get; private set; }
    public int WeightGrams { get; private set; }
    public int LowStockThreshold { get; private set; } = 5;
    public bool IsActive { get; private set; } = true;

    public void Update(string color, string colorHex, string size, string cut, string? barcode, long? priceClp, int weightGrams, int lowStockThreshold, bool isActive, DateTimeOffset now)
    {
        Color = Guard.Required(color, nameof(color), 80);
        if (colorHex.Length != 7 || colorHex[0] != '#') throw new DomainException("El color hexadecimal no es válido.");
        ColorHex = colorHex;
        Size = Guard.Required(size, nameof(size), 30).ToUpperInvariant();
        Cut = Guard.Required(cut, nameof(cut), 40);
        Barcode = string.IsNullOrWhiteSpace(barcode) ? null : Guard.Required(barcode, nameof(barcode), 80);
        PriceClp = priceClp is null ? null : Guard.NonNegative(priceClp.Value, nameof(priceClp));
        if (weightGrams < 0 || lowStockThreshold < 0) throw new DomainException("Peso y umbral no pueden ser negativos.");
        WeightGrams = weightGrams;
        LowStockThreshold = lowStockThreshold;
        IsActive = isActive;
        Touch(now);
    }

    public void SetLowStockThreshold(int threshold)
    {
        if (threshold < 0) throw new DomainException("El umbral no puede ser negativo.");
        LowStockThreshold = threshold;
    }
}

public sealed class ProductImage : Entity
{
    private ProductImage() { }
    public ProductImage(Guid productId, string url, string altText, int displayOrder, bool isPrimary, int width, int height)
    {
        ProductId = productId;
        Url = Guard.Required(url, nameof(url), 1000);
        AltText = Guard.Required(altText, nameof(altText), 240);
        DisplayOrder = displayOrder;
        IsPrimary = isPrimary;
        Width = width;
        Height = height;
    }
    public Guid ProductId { get; private set; }
    public Guid? VariantId { get; private set; }
    public string Url { get; private set; } = string.Empty;
    public string AltText { get; private set; } = string.Empty;
    public int DisplayOrder { get; private set; }
    public bool IsPrimary { get; private set; }
    public int Width { get; private set; }
    public int Height { get; private set; }
}

public sealed class FunctionalFeature : Entity
{
    private FunctionalFeature() { }
    public FunctionalFeature(string name, string slug, string? unit, string description)
    {
        Name = Guard.Required(name, nameof(name), 100);
        Slug = Guard.Required(slug, nameof(slug), 120).ToLowerInvariant();
        Unit = unit;
        Description = Guard.Required(description, nameof(description), 300);
    }
    public string Name { get; private set; } = string.Empty;
    public string Slug { get; private set; } = string.Empty;
    public string? Unit { get; private set; }
    public string Description { get; private set; } = string.Empty;
}

public sealed class ProductFunctionalFeature : Entity
{
    private ProductFunctionalFeature() { }
    public ProductFunctionalFeature(Guid productId, Guid functionalAttributeId, string value, int displayOrder)
    {
        ProductId = productId;
        FunctionalAttributeId = functionalAttributeId;
        Value = Guard.Required(value, nameof(value), 100);
        DisplayOrder = displayOrder;
    }
    public Guid ProductId { get; private set; }
    public Guid FunctionalAttributeId { get; private set; }
    public FunctionalFeature? Attribute { get; private set; }
    public string Value { get; private set; } = string.Empty;
    public int DisplayOrder { get; private set; }
}
