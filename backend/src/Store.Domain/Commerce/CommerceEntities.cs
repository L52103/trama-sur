using Store.Domain.Common;

namespace Store.Domain.Commerce;

public sealed class Cart : Entity
{
    private readonly List<CartItem> _items = [];
    private Cart() { }
    public Cart(string guestTokenHash, DateTimeOffset expiresAt)
    {
        GuestTokenHash = Guard.Required(guestTokenHash, nameof(guestTokenHash), 128);
        ExpiresAt = expiresAt;
    }
    public Guid? UserId { get; private set; }
    public string GuestTokenHash { get; private set; } = string.Empty;
    public string Currency { get; private set; } = "CLP";
    public string? CouponCode { get; private set; }
    public DateTimeOffset ExpiresAt { get; private set; }
    public IReadOnlyCollection<CartItem> Items => _items;

    public CartItem Add(Guid variantId, int quantity)
    {
        if (quantity is < 1 or > 10) throw new DomainException("La cantidad debe estar entre 1 y 10.");
        var existing = _items.SingleOrDefault(x => x.VariantId == variantId);
        if (existing is not null)
        {
            existing.SetQuantity(existing.Quantity + quantity);
            return existing;
        }

        var item = new CartItem(Id, variantId, quantity);
        _items.Add(item);
        return item;
    }

    public void ApplyCoupon(string code, DateTimeOffset now)
    {
        CouponCode = Guard.Required(code, nameof(code), 60).ToUpperInvariant();
        Touch(now);
    }

    public void RemoveCoupon(DateTimeOffset now)
    {
        CouponCode = null;
        Touch(now);
    }
}

public sealed class CartItem : Entity
{
    private CartItem() { }
    public CartItem(Guid cartId, Guid variantId, int quantity)
    {
        CartId = cartId;
        VariantId = variantId;
        SetQuantity(quantity);
    }
    public Guid CartId { get; private set; }
    public Guid VariantId { get; private set; }
    public int Quantity { get; private set; }

    public void SetQuantity(int quantity)
    {
        if (quantity is < 1 or > 10) throw new DomainException("La cantidad debe estar entre 1 y 10.");
        Quantity = quantity;
    }
}

public sealed class Order : Entity
{
    private readonly List<OrderItem> _items = [];
    private readonly List<OrderStatusHistory> _history = [];
    private Order() { }
    public Order(Guid id, string number, string customerEmail, long subtotalClp, long discountClp, long shippingClp, IReadOnlyCollection<OrderItem> items)
    {
        Id = id;
        Number = Guard.Required(number, nameof(number), 40);
        CustomerEmail = Guard.Required(customerEmail, nameof(customerEmail), 254).ToLowerInvariant();
        SubtotalClp = Guard.NonNegative(subtotalClp, nameof(subtotalClp));
        DiscountClp = Guard.NonNegative(discountClp, nameof(discountClp));
        ShippingClp = Guard.NonNegative(shippingClp, nameof(shippingClp));
        TotalClp = checked(SubtotalClp - DiscountClp + ShippingClp);
        if (TotalClp < 0) throw new DomainException("El total no puede ser negativo.");
        Status = OrderStatus.PendingPayment;
        _items.AddRange(items);
    }

    public string Number { get; private set; } = string.Empty;
    public Guid? UserId { get; private set; }
    public Guid? SourceCartId { get; private set; }
    public string CustomerEmail { get; private set; } = string.Empty;
    public OrderStatus Status { get; private set; } = OrderStatus.Draft;
    public long SubtotalClp { get; private set; }
    public long DiscountClp { get; private set; }
    public long ShippingClp { get; private set; }
    public long TotalClp { get; private set; }
    public string Currency { get; private set; } = "CLP";
    public string? CouponCode { get; private set; }
    public DateTimeOffset? PaidAt { get; private set; }
    public DateTimeOffset? CancelledAt { get; private set; }
    public IReadOnlyCollection<OrderItem> Items => _items;
    public IReadOnlyCollection<OrderStatusHistory> History => _history;

    public void AssignUser(Guid userId) => UserId = userId;
    public void AssignCart(Guid cartId) => SourceCartId = cartId;

    public void ApplyCoupon(string couponCode) => CouponCode = Guard.Required(couponCode, nameof(couponCode), 60).ToUpperInvariant();

    public void MarkPaid(DateTimeOffset now)
    {
        if (Status is not OrderStatus.PendingPayment) throw new DomainException("El pedido no está pendiente de pago.");
        Status = OrderStatus.Paid;
        PaidAt = now;
        Touch(now);
    }

    public void MarkPaymentFailed(DateTimeOffset now)
    {
        if (Status is not OrderStatus.PendingPayment) return;
        Status = OrderStatus.PaymentFailed;
        Touch(now);
    }

    public void MarkExpired(DateTimeOffset now)
    {
        if (Status is not OrderStatus.PendingPayment) return;
        Status = OrderStatus.Expired;
        Touch(now);
    }

    public void TransitionTo(OrderStatus next, DateTimeOffset now)
    {
        var allowed = (Status, next) switch
        {
            (OrderStatus.Paid, OrderStatus.Preparing) => true,
            (OrderStatus.Preparing, OrderStatus.ReadyForDispatch) => true,
            (OrderStatus.ReadyForDispatch, OrderStatus.Shipped) => true,
            (OrderStatus.Shipped, OrderStatus.Delivered) => true,
            (OrderStatus.Paid or OrderStatus.Preparing, OrderStatus.Cancelled) => true,
            (OrderStatus.Delivered, OrderStatus.ReturnRequested) => true,
            (OrderStatus.ReturnRequested, OrderStatus.Returned) => true,
            _ => false
        };
        if (!allowed) throw new DomainException($"No se puede cambiar el pedido de {Status} a {next}.");
        Status = next;
        if (next == OrderStatus.Cancelled) CancelledAt = now;
        Touch(now);
    }
}

public sealed class OrderItem : Entity
{
    private OrderItem() { }
    public OrderItem(Guid orderId, Guid variantId, string productName, string sku, string color, string size, int quantity, long unitPriceClp, long discountClp)
    {
        if (quantity <= 0) throw new DomainException("La cantidad debe ser positiva.");
        OrderId = orderId;
        VariantId = variantId;
        ProductName = Guard.Required(productName, nameof(productName), 180);
        Sku = Guard.Required(sku, nameof(sku), 80);
        Color = Guard.Required(color, nameof(color), 80);
        Size = Guard.Required(size, nameof(size), 30);
        Quantity = quantity;
        UnitPriceClp = Guard.NonNegative(unitPriceClp, nameof(unitPriceClp));
        DiscountClp = Guard.NonNegative(discountClp, nameof(discountClp));
        LineTotalClp = checked((UnitPriceClp * quantity) - DiscountClp);
    }

    public void AssignOrder(Guid orderId) => OrderId = orderId;
    public Guid OrderId { get; private set; }
    public Guid VariantId { get; private set; }
    public string ProductName { get; private set; } = string.Empty;
    public string Sku { get; private set; } = string.Empty;
    public string Color { get; private set; } = string.Empty;
    public string Size { get; private set; } = string.Empty;
    public int Quantity { get; private set; }
    public long UnitPriceClp { get; private set; }
    public long DiscountClp { get; private set; }
    public long LineTotalClp { get; private set; }
}

public sealed class OrderAddress : Entity
{
    private OrderAddress() { }
    public OrderAddress(Guid orderId, string recipientName, string phone, string region, string commune, string addressLine1, string? addressLine2, string? instructions)
    {
        OrderId = orderId;
        RecipientName = Guard.Required(recipientName, nameof(recipientName), 160);
        Phone = Guard.Required(phone, nameof(phone), 30);
        Region = Guard.Required(region, nameof(region), 100);
        Commune = Guard.Required(commune, nameof(commune), 100);
        AddressLine1 = Guard.Required(addressLine1, nameof(addressLine1), 180);
        AddressLine2 = addressLine2;
        Instructions = instructions;
    }
    public Guid OrderId { get; private set; }
    public string Type { get; private set; } = "Shipping";
    public string RecipientName { get; private set; } = string.Empty;
    public string Phone { get; private set; } = string.Empty;
    public string Region { get; private set; } = string.Empty;
    public string Commune { get; private set; } = string.Empty;
    public string AddressLine1 { get; private set; } = string.Empty;
    public string? AddressLine2 { get; private set; }
    public string? Instructions { get; private set; }
}

public sealed class OrderStatusHistory : Entity
{
    private OrderStatusHistory() { }
    public Guid OrderId { get; private set; }
    public OrderStatus FromStatus { get; private set; }
    public OrderStatus ToStatus { get; private set; }
    public Guid? ChangedByUserId { get; private set; }
    public string Reason { get; private set; } = string.Empty;
}

public sealed class PaymentTransaction : Entity
{
    private PaymentTransaction() { }
    public PaymentTransaction(Guid orderId, string idempotencyKey, long amountClp)
    {
        OrderId = orderId;
        IdempotencyKey = Guard.Required(idempotencyKey, nameof(idempotencyKey), 100);
        AmountClp = Guard.NonNegative(amountClp, nameof(amountClp));
    }
    public Guid OrderId { get; private set; }
    public string Provider { get; private set; } = "WebpayPlus";
    public string ProviderTransactionId { get; private set; } = string.Empty;
    public string ProviderTokenHash { get; private set; } = string.Empty;
    public string ProviderTokenProtected { get; private set; } = string.Empty;
    public string RedirectUrl { get; private set; } = string.Empty;
    public string IdempotencyKey { get; private set; } = string.Empty;
    public long AmountClp { get; private set; }
    public PaymentStatus Status { get; private set; } = PaymentStatus.Created;
    public string? AuthorizationCode { get; private set; }
    public int? ResponseCode { get; private set; }
    public DateTimeOffset? AuthorizedAt { get; private set; }
    public string AuditPayloadJson { get; private set; } = "{}";

    public void MarkRedirected(string providerTransactionId, string providerTokenHash, string providerTokenProtected, string redirectUrl, DateTimeOffset now)
    {
        ProviderTransactionId = Guard.Required(providerTransactionId, nameof(providerTransactionId), 100);
        ProviderTokenHash = Guard.Required(providerTokenHash, nameof(providerTokenHash), 128);
        ProviderTokenProtected = Guard.Required(providerTokenProtected, nameof(providerTokenProtected), 2000);
        RedirectUrl = Guard.Required(redirectUrl, nameof(redirectUrl), 1000);
        Status = PaymentStatus.Redirected;
        Touch(now);
    }

    public void MarkAuthorized(string authorizationCode, int responseCode, string auditPayloadJson, DateTimeOffset now)
    {
        AuthorizationCode = Guard.Required(authorizationCode, nameof(authorizationCode), 100);
        ResponseCode = responseCode;
        AuditPayloadJson = auditPayloadJson;
        Status = PaymentStatus.Authorized;
        AuthorizedAt = now;
        Touch(now);
    }

    public void MarkRejected(int responseCode, string auditPayloadJson, DateTimeOffset now)
    {
        ResponseCode = responseCode;
        AuditPayloadJson = auditPayloadJson;
        Status = PaymentStatus.Rejected;
        Touch(now);
    }
}

public sealed class ReturnRequest : Entity
{
    private readonly List<ReturnItem> _items = [];
    private ReturnRequest() { }
    public ReturnRequest(Guid orderId, string reason, string customerNotes, IEnumerable<ReturnItem> items)
    {
        OrderId = orderId;
        Reason = Guard.Required(reason, nameof(reason), 300);
        CustomerNotes = Guard.Required(customerNotes, nameof(customerNotes), 2000);
        _items.AddRange(items);
        if (_items.Count == 0) throw new DomainException("Debes seleccionar al menos un artículo.");
        foreach (var item in _items) item.AssignReturn(Id);
    }
    public Guid OrderId { get; private set; }
    public ReturnStatus Status { get; private set; } = ReturnStatus.Requested;
    public string Reason { get; private set; } = string.Empty;
    public string CustomerNotes { get; private set; } = string.Empty;
    public IReadOnlyCollection<ReturnItem> Items => _items;

    public void SetStatus(ReturnStatus status, DateTimeOffset now)
    {
        Status = status;
        Touch(now);
    }
}

public sealed class ReturnItem : Entity
{
    private ReturnItem() { }
    public ReturnItem(Guid orderItemId, int quantity)
    {
        if (quantity <= 0) throw new DomainException("La cantidad debe ser positiva.");
        OrderItemId = orderItemId;
        Quantity = quantity;
    }
    public Guid ReturnRequestId { get; private set; }
    public Guid OrderItemId { get; private set; }
    public int Quantity { get; private set; }
    public string Resolution { get; private set; } = string.Empty;
    internal void AssignReturn(Guid returnRequestId) => ReturnRequestId = returnRequestId;
}
