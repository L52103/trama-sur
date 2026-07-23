using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Encodings.Web;
using System.Text.Json;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace Store.Infrastructure.Services;

public sealed class ResendOptions
{
    public const string SectionName = "Resend";
    public string Mode { get; init; } = "Resend";
    public string ApiKey { get; init; } = string.Empty;
    public string FromEmail { get; init; } = string.Empty;
    public string FromName { get; init; } = "TRAMA SUR";
}

internal interface ITransactionalEmailSender
{
    Task SendAsync(string messageType, string payloadJson, CancellationToken cancellationToken);
}

internal sealed class ResendEmailSender(HttpClient client, IOptions<ResendOptions> options, ILogger<ResendEmailSender> logger) : ITransactionalEmailSender
{
    private static readonly Action<ILogger, string, string, Exception?> LogDevelopmentEmail = LoggerMessage.Define<string, string>(LogLevel.Information, new EventId(2201, "DevelopmentEmail"), "Development email {MessageType} prepared for {RecipientDomain}");
    private readonly ResendOptions _options = options.Value;

    public async Task SendAsync(string messageType, string payloadJson, CancellationToken cancellationToken)
    {
        using var payload = JsonDocument.Parse(payloadJson);
        var root = payload.RootElement;
        var email = Required(root, "email");
        var template = Build(messageType, root);
        if (string.Equals(_options.Mode, "Log", StringComparison.OrdinalIgnoreCase))
        {
            LogDevelopmentEmail(logger, messageType, email.Split('@').LastOrDefault() ?? "invalid", null);
            return;
        }
        if (string.IsNullOrWhiteSpace(_options.ApiKey) || string.IsNullOrWhiteSpace(_options.FromEmail)) throw new InvalidOperationException("Resend no está configurado.");

        using var request = new HttpRequestMessage(HttpMethod.Post, "emails");
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", _options.ApiKey);
        request.Content = JsonContent.Create(new { from = $"{_options.FromName} <{_options.FromEmail}>", to = new[] { email }, subject = template.Subject, html = template.Html });
        using var response = await client.SendAsync(request, cancellationToken);
        if (!response.IsSuccessStatusCode) throw new HttpRequestException($"Resend respondió {(int)response.StatusCode}.");
    }

    private static (string Subject, string Html) Build(string type, JsonElement root)
    {
        var encoder = HtmlEncoder.Default;
        var action = type switch
        {
            "ConfirmEmail" => ("Confirma tu cuenta", "Confirma tu correo para activar tu cuenta.", OptionalUrl(root, "confirmationUrl"), "Confirmar correo"),
            "ResetPassword" => ("Restablece tu contraseña", "Solicitaste restablecer tu contraseña. Si no fuiste tú, ignora este correo.", OptionalUrl(root, "resetUrl"), "Crear nueva contraseña"),
            "OrderPaid" => ($"Pedido {Optional(root, "number")} confirmado", "Recibimos tu pago y comenzaremos a preparar el pedido.", (string?)null, ""),
            "OrderPaymentExpired" => ("La reserva de tu pedido venció", "El plazo de pago terminó y liberamos el inventario. No se registró un cobro confirmado.", (string?)null, ""),
            "ReturnRequested" => ("Recibimos tu solicitud", "Tu solicitud de cambio o devolución fue registrada y será revisada.", (string?)null, ""),
            _ => throw new InvalidOperationException($"Tipo de correo no soportado: {type}.")
        };
        var button = action.Item3 is null ? string.Empty : $"<p style=\"margin:28px 0\"><a href=\"{encoder.Encode(action.Item3)}\" style=\"background:#151515;color:#fff;padding:14px 20px;text-decoration:none\">{encoder.Encode(action.Item4)}</a></p>";
        var html = $"<!doctype html><html lang=\"es\"><body style=\"font-family:Arial,sans-serif;color:#151515;max-width:600px;margin:auto;padding:32px\"><p style=\"letter-spacing:2px;font-weight:bold\">TRAMA <span style=\"color:#1f5a3d\">SUR</span></p><h1 style=\"font-family:Georgia,serif;font-weight:normal\">{encoder.Encode(action.Item1)}</h1><p>{encoder.Encode(action.Item2)}</p>{button}<hr style=\"border:0;border-top:1px solid #ddd;margin-top:40px\"><small>Mensaje transaccional asociado a tu cuenta o compra. Nunca solicitaremos claves bancarias.</small></body></html>";
        return (action.Item1, html);
    }

    private static string Required(JsonElement root, string name) => TryProperty(root, name, out var value) && !string.IsNullOrWhiteSpace(value.GetString()) ? value.GetString()! : throw new InvalidOperationException($"El payload no incluye {name}.");
    private static string Optional(JsonElement root, string name) => TryProperty(root, name, out var value) ? value.ToString() : string.Empty;
    private static bool TryProperty(JsonElement root, string name, out JsonElement value)
    {
        foreach (var property in root.EnumerateObject())
        {
            if (!string.Equals(property.Name, name, StringComparison.OrdinalIgnoreCase)) continue;
            value = property.Value;
            return true;
        }
        value = default;
        return false;
    }
    private static string? OptionalUrl(JsonElement root, string name)
    {
        var raw = Optional(root, name);
        return Uri.TryCreate(raw, UriKind.Absolute, out var uri) && uri.Scheme is "https" or "http" ? uri.ToString() : null;
    }
}
