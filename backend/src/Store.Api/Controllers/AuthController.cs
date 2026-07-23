using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Store.Api.Security;
using Store.Domain.Operations;
using Store.Infrastructure.Identity;
using Store.Infrastructure.Persistence;

namespace Store.Api.Controllers;

public sealed record RegisterRequest(string FirstName, string LastName, string Email, string Password, bool MarketingConsent);
public sealed record LoginRequest(string Email, string Password, string? TwoFactorCode = null);
public sealed record AuthResponse(string AccessToken, DateTimeOffset ExpiresAt, string CsrfToken, object User);
public sealed record ConfirmEmailRequest(Guid UserId, string Token);
public sealed record ForgotPasswordRequest(string Email);
public sealed record ResetPasswordRequest(Guid UserId, string Token, string NewPassword);
public sealed record EnableMfaRequest(string Code);

[ApiController]
[Route("api/v1/auth")]
public sealed class AuthController(
    UserManager<ApplicationUser> userManager,
    SignInManager<ApplicationUser> signInManager,
    AuthTokenService tokenService,
    StoreDbContext db,
    IWebHostEnvironment environment,
    IConfiguration configuration) : ControllerBase
{
    [HttpPost("register")]
    public async Task<IActionResult> Register(RegisterRequest request, CancellationToken cancellationToken)
    {
        var email = request.Email.Trim().ToLowerInvariant();
        var user = new ApplicationUser { Id = Guid.CreateVersion7(), UserName = email, Email = email, FirstName = request.FirstName.Trim(), LastName = request.LastName.Trim(), MarketingConsent = request.MarketingConsent, MarketingConsentAt = request.MarketingConsent ? DateTimeOffset.UtcNow : null };
        var result = await userManager.CreateAsync(user, request.Password);
        if (!result.Succeeded) return ValidationProblem(new ValidationProblemDetails(result.Errors.GroupBy(x => x.Code).ToDictionary(x => x.Key, x => x.Select(e => e.Description).ToArray())));
        await userManager.AddToRoleAsync(user, "Customer");
        var confirmationToken = await userManager.GenerateEmailConfirmationTokenAsync(user);
        var publicUrl = configuration["App:PublicUrl"]?.TrimEnd('/') ?? "http://localhost:4200";
        db.OutboxMessages.Add(new OutboxMessage("ConfirmEmail", JsonSerializer.Serialize(new { user.Id, user.Email, confirmationUrl = $"{publicUrl}/cuenta/confirmar?userId={user.Id}&token={Uri.EscapeDataString(confirmationToken)}" }), DateTimeOffset.UtcNow));
        await db.SaveChangesAsync(cancellationToken);
        return Accepted(new { message = "Revisa tu correo para confirmar la cuenta." });
    }

    [HttpPost("login")]
    public async Task<ActionResult<AuthResponse>> Login(LoginRequest request, CancellationToken cancellationToken)
    {
        var user = await userManager.FindByEmailAsync(request.Email.Trim());
        if (user is null) return Unauthorized(new { message = "Credenciales inválidas." });
        var signIn = await signInManager.CheckPasswordSignInAsync(user, request.Password, lockoutOnFailure: true);
        if (signIn.IsLockedOut) return StatusCode(StatusCodes.Status429TooManyRequests, new { message = "Cuenta temporalmente bloqueada." });
        if (signIn.IsNotAllowed) return Unauthorized(new { message = "Confirma tu correo antes de ingresar." });
        if (!signIn.Succeeded) return Unauthorized(new { message = "Credenciales inválidas." });
        var mfaVerified = false;
        if (user.TwoFactorEnabled)
        {
            if (string.IsNullOrWhiteSpace(request.TwoFactorCode)) return Unauthorized(new { message = "Ingresa el código de autenticación.", requiresTwoFactor = true });
            var code = request.TwoFactorCode.Replace(" ", string.Empty, StringComparison.Ordinal).Replace("-", string.Empty, StringComparison.Ordinal);
            mfaVerified = await userManager.VerifyTwoFactorTokenAsync(user, TokenOptions.DefaultAuthenticatorProvider, code);
            if (!mfaVerified) mfaVerified = (await userManager.RedeemTwoFactorRecoveryCodeAsync(user, code)).Succeeded;
            if (!mfaVerified)
            {
                await userManager.AccessFailedAsync(user);
                return Unauthorized(new { message = "Código de autenticación inválido.", requiresTwoFactor = true });
            }
            await userManager.ResetAccessFailedCountAsync(user);
        }
        user.LastLoginAt = DateTimeOffset.UtcNow;
        var tokens = await tokenService.IssueAsync(user, null, cancellationToken, mfaVerified);
        SetSessionCookies(tokens);
        return Ok(ToResponse(tokens, user, await userManager.GetRolesAsync(user), mfaVerified));
    }

    [HttpPost("refresh")]
    public async Task<ActionResult<AuthResponse>> Refresh(CancellationToken cancellationToken)
    {
        ValidateCsrf();
        var raw = ReadRefreshCookie();
        if (raw is null) return Unauthorized();
        var validated = await tokenService.ValidateRefreshAsync(raw, cancellationToken);
        if (validated is null) return Unauthorized();
        validated.Value.Current.UsedAt = DateTimeOffset.UtcNow;
        var tokens = await tokenService.IssueAsync(validated.Value.User, validated.Value.FamilyId, cancellationToken, validated.Value.Current.MfaVerified);
        validated.Value.Current.ReplacedByTokenHash = AuthTokenService.Hash(tokens.RefreshToken);
        await db.SaveChangesAsync(cancellationToken);
        SetSessionCookies(tokens);
        return Ok(ToResponse(tokens, validated.Value.User, await userManager.GetRolesAsync(validated.Value.User), validated.Value.Current.MfaVerified));
    }

    [HttpPost("logout")]
    public async Task<IActionResult> Logout(CancellationToken cancellationToken)
    {
        ValidateCsrf();
        var raw = ReadRefreshCookie();
        if (raw is not null) await tokenService.RevokeAsync(raw, cancellationToken);
        DeleteSessionCookies();
        return NoContent();
    }

    [HttpPost("confirm-email")]
    public async Task<IActionResult> ConfirmEmail(ConfirmEmailRequest request)
    {
        var user = await userManager.FindByIdAsync(request.UserId.ToString());
        if (user is null) return BadRequest(new { message = "Enlace inválido o vencido." });
        var result = await userManager.ConfirmEmailAsync(user, request.Token);
        return result.Succeeded ? Ok(new { message = "Correo confirmado." }) : BadRequest(new { message = "Enlace inválido o vencido." });
    }

    [HttpPost("forgot-password")]
    public async Task<IActionResult> ForgotPassword(ForgotPasswordRequest request, CancellationToken cancellationToken)
    {
        var user = await userManager.FindByEmailAsync(request.Email.Trim());
        if (user is not null && user.EmailConfirmed)
        {
            var resetToken = await userManager.GeneratePasswordResetTokenAsync(user);
            var publicUrl = configuration["App:PublicUrl"]?.TrimEnd('/') ?? "http://localhost:4200";
            db.OutboxMessages.Add(new OutboxMessage("ResetPassword", JsonSerializer.Serialize(new { user.Id, user.Email, resetUrl = $"{publicUrl}/cuenta/restablecer?userId={user.Id}&token={Uri.EscapeDataString(resetToken)}" }), DateTimeOffset.UtcNow));
            await db.SaveChangesAsync(cancellationToken);
        }
        return Accepted(new { message = "Si la cuenta existe, recibirás instrucciones." });
    }

    [HttpPost("reset-password")]
    public async Task<IActionResult> ResetPassword(ResetPasswordRequest request)
    {
        var user = await userManager.FindByIdAsync(request.UserId.ToString());
        if (user is null) return BadRequest(new { message = "Enlace inválido o vencido." });
        var result = await userManager.ResetPasswordAsync(user, request.Token, request.NewPassword);
        return result.Succeeded ? Ok(new { message = "Contraseña actualizada." }) : BadRequest(new { message = "Enlace inválido o vencido." });
    }

    [Authorize]
    [HttpGet("me")]
    public async Task<IActionResult> Me()
    {
        var id = User.FindFirstValue(ClaimTypes.NameIdentifier);
        var user = id is null ? null : await userManager.FindByIdAsync(id);
        return user is null ? Unauthorized() : Ok(new { user.Id, user.Email, user.FirstName, user.LastName, roles = await userManager.GetRolesAsync(user) });
    }

    [Authorize]
    [HttpPost("mfa/setup")]
    public async Task<IActionResult> SetupMfa()
    {
        var user = await CurrentUserAsync();
        var key = await userManager.GetAuthenticatorKeyAsync(user);
        if (string.IsNullOrWhiteSpace(key))
        {
            await userManager.ResetAuthenticatorKeyAsync(user);
            key = await userManager.GetAuthenticatorKeyAsync(user);
        }
        var issuer = Uri.EscapeDataString("TRAMA SUR");
        var account = Uri.EscapeDataString(user.Email ?? user.UserName ?? user.Id.ToString());
        return Ok(new { sharedKey = key, authenticatorUri = $"otpauth://totp/{issuer}:{account}?secret={key}&issuer={issuer}&digits=6" });
    }

    [Authorize]
    [HttpPost("mfa/enable")]
    public async Task<IActionResult> EnableMfa(EnableMfaRequest request)
    {
        var user = await CurrentUserAsync();
        var code = request.Code.Replace(" ", string.Empty, StringComparison.Ordinal).Replace("-", string.Empty, StringComparison.Ordinal);
        if (!await userManager.VerifyTwoFactorTokenAsync(user, TokenOptions.DefaultAuthenticatorProvider, code)) return BadRequest(new { message = "El código no es válido." });
        await userManager.SetTwoFactorEnabledAsync(user, true);
        var recoveryCodes = await userManager.GenerateNewTwoFactorRecoveryCodesAsync(user, 8);
        return Ok(new { message = "MFA activado. Guarda los códigos de recuperación fuera de línea.", recoveryCodes });
    }

    private async Task<ApplicationUser> CurrentUserAsync()
    {
        var id = User.FindFirstValue(ClaimTypes.NameIdentifier);
        return id is null ? throw new UnauthorizedAccessException() : await userManager.FindByIdAsync(id) ?? throw new UnauthorizedAccessException();
    }

    private static AuthResponse ToResponse(IssuedTokens tokens, ApplicationUser user, IList<string> roles, bool mfaVerified) => new(tokens.AccessToken, tokens.AccessTokenExpiresAt, tokens.CsrfToken, new { user.Id, user.Email, user.FirstName, user.LastName, roles, user.TwoFactorEnabled, MfaVerified = mfaVerified });

    private void SetSessionCookies(IssuedTokens tokens)
    {
        Response.Cookies.Append(RefreshCookieName(), tokens.RefreshToken, new CookieOptions { HttpOnly = true, Secure = !environment.IsDevelopment(), SameSite = SameSiteMode.Lax, Path = "/api/v1/auth", MaxAge = TimeSpan.FromDays(30), IsEssential = true });
        Response.Cookies.Append(CsrfCookieName(), tokens.CsrfToken, new CookieOptions { HttpOnly = false, Secure = !environment.IsDevelopment(), SameSite = SameSiteMode.Lax, Path = "/api/v1/auth", MaxAge = TimeSpan.FromDays(30), IsEssential = true });
    }

    private void DeleteSessionCookies()
    {
        Response.Cookies.Delete(RefreshCookieName(), new CookieOptions { Path = "/api/v1/auth" });
        Response.Cookies.Delete(CsrfCookieName(), new CookieOptions { Path = "/api/v1/auth" });
    }

    private string? ReadRefreshCookie() => Request.Cookies.TryGetValue(RefreshCookieName(), out var token) ? token : null;
    private string RefreshCookieName() => environment.IsDevelopment() ? "trama_refresh" : "__Secure-trama_refresh";
    private string CsrfCookieName() => environment.IsDevelopment() ? "trama_csrf" : "__Secure-trama_csrf";

    private void ValidateCsrf()
    {
        if (!Request.Cookies.TryGetValue(CsrfCookieName(), out var cookie) || !Request.Headers.TryGetValue("X-CSRF-Token", out var header) || header.Count != 1 || !FixedTimeEquals(cookie, header[0] ?? string.Empty))
            throw new UnauthorizedAccessException("CSRF validation failed.");
    }

    private static bool FixedTimeEquals(string left, string right)
    {
        var a = Encoding.UTF8.GetBytes(left);
        var b = Encoding.UTF8.GetBytes(right);
        return a.Length == b.Length && CryptographicOperations.FixedTimeEquals(a, b);
    }
}
