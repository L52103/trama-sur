using Store.Domain.Commerce;
using Store.Domain.Common;
using Store.Domain.Catalog;

namespace Store.UnitTests;

public sealed class CommerceDomainTests
{
    private static readonly DateTimeOffset Now = new(2026, 7, 13, 12, 0, 0, TimeSpan.Zero);

    [Fact]
    public void Inventory_reserve_reduces_available_without_reducing_on_hand()
    {
        var item = new InventoryItem(Guid.NewGuid(), Guid.NewGuid(), 10);
        item.Reserve(4, Now);
        Assert.Equal(10, item.OnHand);
        Assert.Equal(4, item.Reserved);
        Assert.Equal(6, item.Available);
    }

    [Fact]
    public void Inventory_rejects_overselling()
    {
        var item = new InventoryItem(Guid.NewGuid(), Guid.NewGuid(), 2);
        Assert.Throws<DomainException>(() => item.Reserve(3, Now));
        Assert.Equal(2, item.Available);
    }

    [Fact]
    public void Inventory_commit_consumes_only_reserved_units()
    {
        var item = new InventoryItem(Guid.NewGuid(), Guid.NewGuid(), 10);
        item.Reserve(3, Now);
        item.Commit(3, Now.AddMinutes(1));
        Assert.Equal(7, item.OnHand);
        Assert.Equal(0, item.Reserved);
    }

    [Fact]
    public void Inventory_release_is_idempotency_guarded_by_quantity()
    {
        var item = new InventoryItem(Guid.NewGuid(), Guid.NewGuid(), 5);
        item.Reserve(2, Now);
        item.Release(2, Now.AddMinutes(1));
        Assert.Throws<DomainException>(() => item.Release(2, Now.AddMinutes(2)));
        Assert.Equal(5, item.Available);
    }

    [Fact]
    public void Reservation_tracks_exact_inventory_allocations_and_commits_once()
    {
        var allocation = new StockReservationItem(Guid.NewGuid(), 2);
        var reservation = new StockReservation(Guid.NewGuid(), DateTimeOffset.UtcNow.AddMinutes(15), [allocation]);
        reservation.Commit(Now);
        reservation.Commit(Now.AddMinutes(1));
        Assert.Equal(ReservationStatus.Committed, reservation.Status);
        Assert.Equal(reservation.Id, allocation.StockReservationId);
    }

    [Fact]
    public void Expired_reservation_cannot_be_committed()
    {
        var reservation = new StockReservation(Guid.NewGuid(), DateTimeOffset.UtcNow.AddMinutes(15), [new StockReservationItem(Guid.NewGuid(), 1)]);
        reservation.Release(Now, expired: true);
        Assert.Throws<DomainException>(() => reservation.Commit(Now.AddMinutes(1)));
        Assert.Equal(ReservationStatus.Expired, reservation.Status);
    }

    [Fact]
    public void Cart_merges_same_variant_and_enforces_ten_unit_limit()
    {
        var cart = new Cart("AABBCC", Now.AddDays(30));
        var variantId = Guid.NewGuid();
        cart.Add(variantId, 4);
        cart.Add(variantId, 5);
        Assert.Single(cart.Items);
        Assert.Equal(9, cart.Items.Single().Quantity);
        Assert.Throws<DomainException>(() => cart.Add(variantId, 2));
    }

    [Fact]
    public void Order_calculates_integer_clp_total_and_marks_paid()
    {
        var orderId = Guid.NewGuid();
        var item = new OrderItem(orderId, Guid.NewGuid(), "Chaqueta", "SKU-1", "Bosque", "M", 2, 39_990, 5_000);
        var order = new Order(orderId, "TS-2026-100001", "CLIENTE@EXAMPLE.CL", 74_980, 0, 4_990, [item]);
        order.MarkPaid(Now);
        Assert.Equal(79_970, order.TotalClp);
        Assert.Equal("cliente@example.cl", order.CustomerEmail);
        Assert.Equal(OrderStatus.Paid, order.Status);
    }

    [Fact]
    public void Order_cannot_be_paid_twice()
    {
        var orderId = Guid.NewGuid();
        var order = new Order(orderId, "TS-2026-100002", "a@b.cl", 10_000, 0, 0, [new OrderItem(orderId, Guid.NewGuid(), "Polera", "SKU-2", "Crudo", "S", 1, 10_000, 0)]);
        order.MarkPaid(Now);
        Assert.Throws<DomainException>(() => order.MarkPaid(Now.AddSeconds(1)));
    }

    [Fact]
    public void Payment_authorization_preserves_minimal_audit_without_card_data()
    {
        var payment = new PaymentTransaction(Guid.NewGuid(), "idem-1", 45_990);
        payment.MarkRedirected("tx-1", "HASH", "PROTECTED", "https://webpay.example/redirect", Now);
        payment.MarkAuthorized("AUTH123", 0, "{\"status\":\"AUTHORIZED\"}", Now.AddMinutes(1));
        Assert.Equal(PaymentStatus.Authorized, payment.Status);
        Assert.Equal("AUTH123", payment.AuthorizationCode);
        Assert.DoesNotContain("card", payment.AuditPayloadJson, StringComparison.OrdinalIgnoreCase);
    }

    [Theory]
    [InlineData(0)]
    [InlineData(-1)]
    public void Order_item_rejects_non_positive_quantity(int quantity) =>
        Assert.Throws<DomainException>(() => new OrderItem(Guid.NewGuid(), Guid.NewGuid(), "Producto", "SKU", "Negro", "M", quantity, 1_000, 0));

    [Fact]
    public void Percentage_promotion_uses_integer_clp_without_rounding_ambiguity()
    {
        var promotion = new Promotion("Bienvenida", "HOLA10", PromotionType.Percentage, 10, 20_000, Now.AddDays(-1), Now.AddDays(1), 100, 1);
        Assert.Equal(3_999, promotion.CalculateDiscount(39_990, 4_990, Now));
    }

    [Fact]
    public void Fixed_promotion_never_makes_subtotal_negative()
    {
        var promotion = new Promotion("Descuento fijo", "FIJO", PromotionType.FixedAmount, 50_000, 0, Now.AddDays(-1), Now.AddDays(1), null, null);
        Assert.Equal(12_000, promotion.CalculateDiscount(12_000, 4_990, Now));
    }

    [Fact]
    public void Free_shipping_promotion_discounts_exact_shipping_amount()
    {
        var promotion = new Promotion("Envío", "ENVIO", PromotionType.FreeShipping, 1, 0, Now.AddDays(-1), Now.AddDays(1), null, null);
        Assert.Equal(7_990, promotion.CalculateDiscount(20_000, 7_990, Now));
    }
}
