using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Store.Domain.Operations;

namespace Store.Api.Infrastructure;

internal static class AuditLogFactory
{
    public static AuditLog Create(ClaimsPrincipal user, HttpContext context, IConfiguration configuration, string action, string resourceType, string resourceId, object changes)
    {
        var userId = Guid.TryParse(user.FindFirstValue(ClaimTypes.NameIdentifier), out var parsed) ? parsed : null as Guid?;
        var ip = context.Connection.RemoteIpAddress?.ToString() ?? "unknown";
        var key = configuration["Auth:SigningKey"] ?? throw new InvalidOperationException("Falta la clave para auditoría.");
        var hash = Convert.ToHexString(HMACSHA256.HashData(Encoding.UTF8.GetBytes(key), Encoding.UTF8.GetBytes(ip)));
        return new AuditLog(userId, action, resourceType, resourceId, JsonSerializer.Serialize(changes), context.TraceIdentifier, hash);
    }
}

