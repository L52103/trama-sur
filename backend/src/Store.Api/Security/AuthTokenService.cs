using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;
using Store.Infrastructure.Identity;
using Store.Infrastructure.Persistence;

namespace Store.Api.Security;

public sealed class AuthOptions
{
    public const string SectionName = "Auth";
    public string Issuer { get; init; } = string.Empty;
    public string Audience { get; init; } = string.Empty;
    public string SigningKey { get; init; } = string.Empty;
    public int AccessTokenMinutes { get; init; } = 15;
    public int RefreshTokenDays { get; init; } = 30;
}

public sealed record IssuedTokens(string AccessToken, DateTimeOffset AccessTokenExpiresAt, string RefreshToken, string CsrfToken);

public sealed class AuthTokenService(StoreDbContext db, UserManager<ApplicationUser> userManager, IOptions<AuthOptions> options)
{
    private readonly AuthOptions _options = options.Value;

    public async Task<IssuedTokens> IssueAsync(ApplicationUser user, Guid? familyId, CancellationToken cancellationToken, bool mfaVerified = false)
    {
        ValidateConfiguration();
        var now = DateTimeOffset.UtcNow;
        var expires = now.AddMinutes(Math.Clamp(_options.AccessTokenMinutes, 5, 30));
        var roles = await userManager.GetRolesAsync(user);
        var claims = new List<Claim>
        {
            new(JwtRegisteredClaimNames.Sub, user.Id.ToString()),
            new(JwtRegisteredClaimNames.Email, user.Email ?? string.Empty),
            new(JwtRegisteredClaimNames.Jti, Guid.CreateVersion7().ToString()),
            new(ClaimTypes.NameIdentifier, user.Id.ToString())
        };
        claims.AddRange(roles.Select(role => new Claim(ClaimTypes.Role, role)));
        if (mfaVerified) claims.Add(new Claim("amr", "mfa"));
        var credentials = new SigningCredentials(new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_options.SigningKey)), SecurityAlgorithms.HmacSha256);
        var jwt = new JwtSecurityToken(_options.Issuer, _options.Audience, claims, now.UtcDateTime, expires.UtcDateTime, credentials);

        var rawRefresh = Base64UrlEncoder.Encode(RandomNumberGenerator.GetBytes(64));
        var refresh = new RefreshToken
        {
            UserId = user.Id,
            TokenHash = Hash(rawRefresh),
            FamilyId = familyId ?? Guid.CreateVersion7(),
            ExpiresAt = now.AddDays(Math.Clamp(_options.RefreshTokenDays, 1, 60)),
            MfaVerified = mfaVerified
        };
        db.RefreshTokens.Add(refresh);
        await db.SaveChangesAsync(cancellationToken);
        return new IssuedTokens(new JwtSecurityTokenHandler().WriteToken(jwt), expires, rawRefresh, Base64UrlEncoder.Encode(RandomNumberGenerator.GetBytes(32)));
    }

    public async Task<(ApplicationUser User, Guid FamilyId, RefreshToken Current)?> ValidateRefreshAsync(string rawToken, CancellationToken cancellationToken)
    {
        var hash = Hash(rawToken);
        var current = await db.RefreshTokens.Include(x => x.User).SingleOrDefaultAsync(x => x.TokenHash == hash, cancellationToken);
        if (current?.User is null) return null;
        if (current.RevokedAt is not null || current.UsedAt is not null || current.ExpiresAt <= DateTimeOffset.UtcNow)
        {
            var family = await db.RefreshTokens.Where(x => x.UserId == current.UserId && x.FamilyId == current.FamilyId && x.RevokedAt == null).ToListAsync(cancellationToken);
            foreach (var token in family) token.RevokedAt = DateTimeOffset.UtcNow;
            await db.SaveChangesAsync(cancellationToken);
            return null;
        }
        return (current.User, current.FamilyId, current);
    }

    public async Task RevokeAsync(string rawToken, CancellationToken cancellationToken)
    {
        var hash = Hash(rawToken);
        var current = await db.RefreshTokens.SingleOrDefaultAsync(x => x.TokenHash == hash, cancellationToken);
        if (current is null) return;
        current.RevokedAt = DateTimeOffset.UtcNow;
        await db.SaveChangesAsync(cancellationToken);
    }

    public static string Hash(string value) => Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(value)));

    private void ValidateConfiguration()
    {
        if (_options.SigningKey.Length < 64 || !Uri.TryCreate(_options.Issuer, UriKind.Absolute, out _) || !Uri.TryCreate(_options.Audience, UriKind.Absolute, out _))
            throw new InvalidOperationException("La configuración de autenticación no cumple los mínimos de seguridad.");
    }
}
