namespace Store.Application.Payments;

public sealed record CreatePaymentRequest(Guid OrderId, string IdempotencyKey);
public sealed record PaymentRedirectDto(Guid PaymentId, string Token, Uri RedirectUrl, long AmountClp);
public sealed record PaymentResultDto(Guid OrderId, string OrderNumber, string Status, bool Authorized, string PublicMessage);

public interface IPaymentService
{
    Task<PaymentRedirectDto> CreateWebpayAsync(CreatePaymentRequest request, CancellationToken cancellationToken);
    Task<PaymentResultDto> CommitWebpayAsync(string token, CancellationToken cancellationToken);
    Task<PaymentResultDto?> GetStatusAsync(Guid orderId, CancellationToken cancellationToken);
}

