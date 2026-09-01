using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.Logging;
using Store.Infrastructure.Identity;
using Store.Infrastructure.Persistence;

namespace Store.Infrastructure.Security;

public interface ISecurityAuditService
{
    void RecordFailedLogin(string ipAddress, string email);
    void RecordSuccessfulLogin(string ipAddress, string email);
    void RecordAbnormalPaymentRejection(string ipAddress, Guid orderId, string reason);
    Task<bool> RevokeUserSessionsAsync(Guid userId, CancellationToken cancellationToken = default);
}

public sealed class SecurityAuditService : ISecurityAuditService
{
    private static readonly Action<ILogger, string, string, Exception?> LogFailedLoginMsg =
        LoggerMessage.Define<string, string>(
            LogLevel.Warning,
            new EventId(4101, "SecurityAuditFailedLogin"),
            "[SECURITY AUDIT] Intento fallido de inicio de sesión. IP: {IpAddress}, Email: {Email}");

    private static readonly Action<ILogger, string, string, Exception?> LogSuccessLoginMsg =
        LoggerMessage.Define<string, string>(
            LogLevel.Information,
            new EventId(2102, "SecurityAuditSuccessLogin"),
            "[SECURITY AUDIT] Inicio de sesión exitoso. IP: {IpAddress}, Email: {Email}");

    private static readonly Action<ILogger, string, Guid, string, Exception?> LogPaymentRejectionMsg =
        LoggerMessage.Define<string, Guid, string>(
            LogLevel.Warning,
            new EventId(4102, "SecurityAuditPaymentRejection"),
            "[SECURITY AUDIT] Transacción rechazada. IP: {IpAddress}, OrderId: {OrderId}, Razón: {Reason}");

    private static readonly Action<ILogger, Guid, string?, Exception?> LogSessionRevokedMsg =
        LoggerMessage.Define<Guid, string?>(
            LogLevel.Warning,
            new EventId(4103, "SecurityAuditSessionRevoked"),
            "[SECURITY INCIDENT] Revocación forzada de tokens de sesión para usuario {UserId} ({Email})");

    private readonly ILogger<SecurityAuditService> _logger;
    private readonly UserManager<ApplicationUser> _userManager;
    private readonly StoreDbContext _db;

    public SecurityAuditService(
        ILogger<SecurityAuditService> logger,
        UserManager<ApplicationUser> userManager,
        StoreDbContext db)
    {
        _logger = logger;
        _userManager = userManager;
        _db = db;
    }

    public void RecordFailedLogin(string ipAddress, string email)
    {
        LogFailedLoginMsg(_logger, ipAddress, email, null);
    }

    public void RecordSuccessfulLogin(string ipAddress, string email)
    {
        LogSuccessLoginMsg(_logger, ipAddress, email, null);
    }

    public void RecordAbnormalPaymentRejection(string ipAddress, Guid orderId, string reason)
    {
        LogPaymentRejectionMsg(_logger, ipAddress, orderId, reason, null);
    }

    public async Task<bool> RevokeUserSessionsAsync(Guid userId, CancellationToken cancellationToken = default)
    {
        var user = await _userManager.FindByIdAsync(userId.ToString());
        if (user is null) return false;

        var result = await _userManager.UpdateSecurityStampAsync(user);
        if (result.Succeeded)
        {
            LogSessionRevokedMsg(_logger, userId, user.Email, null);
            return true;
        }

        return false;
    }
}
