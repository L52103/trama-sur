using System.Globalization;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.Extensions.Options;
using Store.Application.Common;

namespace Store.Infrastructure.Payments;

public sealed class WebpayOptions
{
    public const string SectionName = "Transbank";
    public string Environment { get; init; } = "Integration";
    public string CommerceCode { get; init; } = "597055555532";
    public string ApiKey { get; init; } = "579B532A7440BB0C9079DED94D31EA1615BACEB56610332264630D42D0A36B1C";
    public string ReturnUrl { get; init; } = "https://trama-sur.onrender.com/api/v1/payments/webpay/return";
}

internal sealed record WebpayCreateResult(string Token, Uri Url);
internal sealed record WebpayCommitResult(string Status, int ResponseCode, long Amount, string AuthorizationCode, string BuyOrder, DateTimeOffset? TransactionDate);

internal interface IWebpayGateway
{
    Task<WebpayCreateResult> CreateAsync(string buyOrder, string sessionId, long amountClp, CancellationToken cancellationToken);
    Task<WebpayCommitResult> CommitAsync(string token, CancellationToken cancellationToken);
}

internal sealed class WebpayGateway(HttpClient client, IOptions<WebpayOptions> options) : IWebpayGateway
{
    private const string DefaultIntegrationCode = "597055555532";
    private const string DefaultIntegrationApiKey = "579B532A7440BB0C9079DED94D31EA1615BACEB56610332264630D42D0A36B1C";
    private const string DefaultReturnUrl = "https://trama-sur.onrender.com/api/v1/payments/webpay/return";

    private string CommerceCode => string.IsNullOrWhiteSpace(options.Value.CommerceCode) ? DefaultIntegrationCode : options.Value.CommerceCode;
    private string ApiKey => string.IsNullOrWhiteSpace(options.Value.ApiKey) ? DefaultIntegrationApiKey : options.Value.ApiKey;
    private string ReturnUrl => string.IsNullOrWhiteSpace(options.Value.ReturnUrl) || !Uri.TryCreate(options.Value.ReturnUrl, UriKind.Absolute, out _) ? DefaultReturnUrl : options.Value.ReturnUrl;

    public async Task<WebpayCreateResult> CreateAsync(string buyOrder, string sessionId, long amountClp, CancellationToken cancellationToken)
    {
        using var request = BuildRequest(HttpMethod.Post, "transactions");
        request.Content = JsonContent.Create(new { buy_order = buyOrder, session_id = sessionId, amount = amountClp, return_url = ReturnUrl });
        using var response = await SendAsync(request, cancellationToken);
        using var json = await JsonDocument.ParseAsync(await response.Content.ReadAsStreamAsync(cancellationToken), cancellationToken: cancellationToken);
        var token = json.RootElement.GetProperty("token").GetString() ?? throw new InvalidOperationException("Webpay no entregó token.");
        var url = json.RootElement.GetProperty("url").GetString() ?? throw new InvalidOperationException("Webpay no entregó URL.");
        return new WebpayCreateResult(token, new Uri(url, UriKind.Absolute));
    }

    public async Task<WebpayCommitResult> CommitAsync(string token, CancellationToken cancellationToken)
    {
        using var request = BuildRequest(HttpMethod.Put, $"transactions/{Uri.EscapeDataString(token)}");
        using var response = await SendAsync(request, cancellationToken);
        using var json = await JsonDocument.ParseAsync(await response.Content.ReadAsStreamAsync(cancellationToken), cancellationToken: cancellationToken);
        var root = json.RootElement;
        DateTimeOffset? transactionDate = null;
        if (root.TryGetProperty("transaction_date", out var dateElement) && DateTimeOffset.TryParse(dateElement.GetString(), CultureInfo.InvariantCulture, DateTimeStyles.AssumeUniversal, out var parsed)) transactionDate = parsed;
        return new WebpayCommitResult(
            root.GetProperty("status").GetString() ?? "UNKNOWN",
            root.GetProperty("response_code").GetInt32(),
            root.GetProperty("amount").GetInt64(),
            root.TryGetProperty("authorization_code", out var authorization) ? authorization.GetString() ?? string.Empty : string.Empty,
            root.GetProperty("buy_order").GetString() ?? string.Empty,
            transactionDate);
    }

    private HttpRequestMessage BuildRequest(HttpMethod method, string path)
    {
        var request = new HttpRequestMessage(method, path);
        request.Headers.Add("Tbk-Api-Key-Id", CommerceCode);
        request.Headers.Add("Tbk-Api-Key-Secret", ApiKey);
        request.Headers.Accept.ParseAdd("application/json");
        return request;
    }

    private async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
    {
        try
        {
            var response = await client.SendAsync(request, HttpCompletionOption.ResponseHeadersRead, cancellationToken);
            if (response.IsSuccessStatusCode) return response;
            response.Dispose();
            throw new ExternalServiceUnavailableException("Webpay no pudo iniciar o confirmar la transacción. Intenta nuevamente en unos minutos.");
        }
        catch (OperationCanceledException) when (!cancellationToken.IsCancellationRequested)
        {
            throw new ExternalServiceUnavailableException("Webpay tardó demasiado en responder. Intenta nuevamente.");
        }
        catch (HttpRequestException exception)
        {
            throw new ExternalServiceUnavailableException("No fue posible conectar con Webpay. Intenta nuevamente en unos minutos.", exception);
        }
    }
}
