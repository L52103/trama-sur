using Store.Domain.Common;

namespace Store.Domain.Commerce;

public sealed class Warehouse : Entity
{
    private Warehouse() { }
    public Warehouse(string name, string code)
    {
        Name = Guard.Required(name, nameof(name), 100);
        Code = Guard.Required(code, nameof(code), 30).ToUpperInvariant();
    }
    public string Name { get; private set; } = string.Empty;
    public string Code { get; private set; } = string.Empty;
    public bool IsActive { get; private set; } = true;
}

public sealed class InventoryItem : Entity
{
    private InventoryItem() { }

    public InventoryItem(Guid warehouseId, Guid variantId, int initialStock)
    {
        if (initialStock < 0) throw new DomainException("El stock inicial no puede ser negativo.");
        WarehouseId = warehouseId;
        VariantId = variantId;
        OnHand = initialStock;
    }

    public Guid WarehouseId { get; private set; }
    public Guid VariantId { get; private set; }
    public int OnHand { get; private set; }
    public int Reserved { get; private set; }
    public int Available => OnHand - Reserved;
    public uint RowVersion { get; private set; }

    public void Reserve(int quantity, DateTimeOffset now)
    {
        if (quantity <= 0) throw new DomainException("La cantidad debe ser positiva.");
        if (Available < quantity) throw new DomainException("No hay stock suficiente.");
        Reserved += quantity;
        Touch(now);
    }

    public void Commit(int quantity, DateTimeOffset now)
    {
        if (quantity <= 0 || Reserved < quantity || OnHand < quantity)
            throw new DomainException("La reserva no se puede confirmar.");
        Reserved -= quantity;
        OnHand -= quantity;
        Touch(now);
    }

    public void Release(int quantity, DateTimeOffset now)
    {
        if (quantity <= 0 || Reserved < quantity) throw new DomainException("La reserva no se puede liberar.");
        Reserved -= quantity;
        Touch(now);
    }

    public void AdjustOnHand(int quantityDelta, DateTimeOffset now)
    {
        var next = checked(OnHand + quantityDelta);
        if (next < Reserved) throw new DomainException("El ajuste dejaría stock físico bajo lo ya reservado.");
        OnHand = next;
        Touch(now);
    }
}

public sealed class InventoryMovement : Entity
{
    private InventoryMovement() { }
    public InventoryMovement(Guid inventoryItemId, InventoryMovementType type, int quantityDelta, int previousOnHand, int newOnHand, string reason, string? reference, Guid? performedByUserId)
    {
        InventoryItemId = inventoryItemId;
        Type = type;
        QuantityDelta = quantityDelta;
        PreviousOnHand = previousOnHand;
        NewOnHand = newOnHand;
        Reason = Guard.Required(reason, nameof(reason), 300);
        Reference = reference;
        PerformedByUserId = performedByUserId;
    }
    public Guid InventoryItemId { get; private set; }
    public InventoryMovementType Type { get; private set; }
    public int QuantityDelta { get; private set; }
    public int PreviousOnHand { get; private set; }
    public int NewOnHand { get; private set; }
    public string Reason { get; private set; } = string.Empty;
    public string? Reference { get; private set; }
    public Guid? PerformedByUserId { get; private set; }
}

public sealed class StockReservation : Entity
{
    private readonly List<StockReservationItem> _items = [];
    private StockReservation() { }
    public StockReservation(Guid orderId, DateTimeOffset expiresAt, IEnumerable<StockReservationItem> items)
    {
        if (expiresAt <= DateTimeOffset.UtcNow) throw new DomainException("La reserva debe vencer en el futuro.");
        OrderId = orderId;
        ExpiresAt = expiresAt;
        _items.AddRange(items);
        if (_items.Count == 0) throw new DomainException("La reserva debe contener al menos un artículo.");
        foreach (var item in _items) item.AssignReservation(Id);
    }
    public Guid OrderId { get; private set; }
    public ReservationStatus Status { get; private set; } = ReservationStatus.Active;
    public DateTimeOffset ExpiresAt { get; private set; }
    public IReadOnlyCollection<StockReservationItem> Items => _items;

    public void Commit(DateTimeOffset now)
    {
        if (Status is ReservationStatus.Committed) return;
        if (Status is not ReservationStatus.Active) throw new DomainException("La reserva ya no está activa.");
        Status = ReservationStatus.Committed;
        Touch(now);
    }

    public void Release(DateTimeOffset now, bool expired = false)
    {
        if (Status is ReservationStatus.Released or ReservationStatus.Expired) return;
        if (Status is not ReservationStatus.Active) throw new DomainException("La reserva no se puede liberar.");
        Status = expired ? ReservationStatus.Expired : ReservationStatus.Released;
        Touch(now);
    }
}

public sealed class StockReservationItem : Entity
{
    private StockReservationItem() { }
    public StockReservationItem(Guid inventoryItemId, int quantity)
    {
        if (quantity <= 0) throw new DomainException("La cantidad reservada debe ser positiva.");
        InventoryItemId = inventoryItemId;
        Quantity = quantity;
    }
    public Guid StockReservationId { get; private set; }
    public Guid InventoryItemId { get; private set; }
    public int Quantity { get; private set; }
    internal void AssignReservation(Guid reservationId) => StockReservationId = reservationId;
}
