namespace Store.Domain.Common;

public enum ProductStatus { Draft, Active, Archived }
public enum OrderStatus { Draft, PendingPayment, PaymentFailed, Expired, Paid, Preparing, ReadyForDispatch, Shipped, Delivered, Cancelled, ReturnRequested, Returned, Refunded, PartiallyRefunded }
public enum PaymentStatus { Created, Redirected, Pending, Authorized, Rejected, Cancelled, Expired, RefundPending, Refunded, PartiallyRefunded, Error }
public enum ReservationStatus { Active, Committed, Released, Expired }
public enum InventoryMovementType { InitialStock, Purchase, ManualAdjustment, Sale, Return, Damage, Reservation, ReservationRelease, Transfer }
public enum ReturnStatus { Requested, UnderReview, Approved, Rejected, Received, Refunded, Closed }
public enum PublicationStatus { Draft, Scheduled, Published, Archived }
public enum PromotionType { Percentage, FixedAmount, FreeShipping }
public enum PromotionRedemptionStatus { Reserved, Committed, Released }
