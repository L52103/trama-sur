using System.Text;
using System.Threading.RateLimiting;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Diagnostics.HealthChecks;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi;
using Serilog;
using Store.Api.Infrastructure;
using Store.Api.Security;
using Store.Application;
using Store.Infrastructure;
using Store.Infrastructure.Identity;
using Store.Infrastructure.Persistence;

var builder = WebApplication.CreateBuilder(args);
if (builder.Environment.IsProduction()) ValidateProductionConfiguration(builder.Configuration);
builder.Host.UseSerilog((context, services, configuration) => configuration
    .ReadFrom.Configuration(context.Configuration)
    .ReadFrom.Services(services)
    .Enrich.FromLogContext()
    .Enrich.WithProperty("service", "store-api")
    .WriteTo.Console(new Serilog.Formatting.Json.JsonFormatter()));

builder.WebHost.ConfigureKestrel(options => options.Limits.MaxRequestBodySize = 10 * 1024 * 1024);
builder.Services.AddApplication();
builder.Services.AddInfrastructure(builder.Configuration);
builder.Services.AddControllers().AddJsonOptions(options =>
{
    options.JsonSerializerOptions.PropertyNamingPolicy = System.Text.Json.JsonNamingPolicy.CamelCase;
    options.JsonSerializerOptions.Converters.Add(new System.Text.Json.Serialization.JsonStringEnumConverter());
    options.JsonSerializerOptions.ReferenceHandler = System.Text.Json.Serialization.ReferenceHandler.IgnoreCycles;
});
builder.Services.AddProblemDetails(options => options.CustomizeProblemDetails = context =>
{
    context.ProblemDetails.Extensions["requestId"] = context.HttpContext.TraceIdentifier;
    context.ProblemDetails.Instance = context.HttpContext.Request.Path;
});
builder.Services.AddExceptionHandler<ApiExceptionHandler>();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(options =>
{
    options.SwaggerDoc("v1", new OpenApiInfo { Title = "TRAMA SUR Store API", Version = "v1", Description = "API de ecommerce para Chile. Los montos están expresados en CLP enteros." });
    options.AddSecurityDefinition("Bearer", new OpenApiSecurityScheme { Type = SecuritySchemeType.Http, Scheme = "bearer", BearerFormat = "JWT" });
});

var auth = builder.Configuration.GetSection(AuthOptions.SectionName).Get<AuthOptions>() ?? new AuthOptions();
builder.Services.Configure<AuthOptions>(builder.Configuration.GetSection(AuthOptions.SectionName));
if (auth.SigningKey.Length < 64) throw new InvalidOperationException("Auth:SigningKey debe contener al menos 64 caracteres.");
builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme).AddJwtBearer(options =>
{
    options.MapInboundClaims = false;
    options.TokenValidationParameters = new TokenValidationParameters
    {
        ValidateIssuer = true,
        ValidIssuer = auth.Issuer,
        ValidateAudience = true,
        ValidAudience = auth.Audience,
        ValidateIssuerSigningKey = true,
        IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(auth.SigningKey)),
        ValidateLifetime = true,
        ClockSkew = TimeSpan.FromSeconds(30),
        NameClaimType = System.Security.Claims.ClaimTypes.NameIdentifier,
        RoleClaimType = System.Security.Claims.ClaimTypes.Role
    };
});
builder.Services.AddAuthorizationBuilder()
    .AddPolicy("CatalogWrite", policy => policy.RequireRole("Admin", "CatalogManager").RequireClaim("amr", "mfa"))
    .AddPolicy("InventoryWrite", policy => policy.RequireRole("Admin", "InventoryManager").RequireClaim("amr", "mfa"))
    .AddPolicy("OrderWrite", policy => policy.RequireRole("Admin", "OrderManager").RequireClaim("amr", "mfa"))
    .AddPolicy("ContentPublish", policy => policy.RequireRole("Admin", "ContentPublisher").RequireClaim("amr", "mfa"));
builder.Services.AddScoped<AuthTokenService>();

var origins = builder.Configuration.GetSection("App:AllowedOrigins").Get<string[]>() ?? ["http://localhost:4200"];
builder.Services.AddCors(options => options.AddPolicy("storefront", policy => policy.WithOrigins(origins).AllowCredentials().WithHeaders("Content-Type", "Authorization", "Idempotency-Key", "X-CSRF-Token", "X-Request-ID").WithMethods("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS")));
builder.Services.AddRateLimiter(options =>
{
    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
    options.GlobalLimiter = PartitionedRateLimiter.Create<HttpContext, string>(context =>
    {
        var isStrict = context.Request.Path.StartsWithSegments("/api/v1/auth") || context.Request.Path.StartsWithSegments("/api/v1/payments") || context.Request.Path.StartsWithSegments("/api/v1/returns");
        var partition = (context.User.Identity?.Name ?? context.Connection.RemoteIpAddress?.ToString() ?? "unknown") + (isStrict ? "-strict" : "-normal");
        return RateLimitPartition.GetTokenBucketLimiter(partition, _ => new TokenBucketRateLimiterOptions
        {
            TokenLimit = isStrict ? 10 : 120,
            TokensPerPeriod = isStrict ? 10 : 120,
            ReplenishmentPeriod = TimeSpan.FromMinutes(1),
            QueueLimit = 0,
            AutoReplenishment = true
        });
    });
});

var app = builder.Build();
app.UseForwardedHeaders(new ForwardedHeadersOptions { ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto, ForwardLimit = 2 });
app.UseExceptionHandler();
app.Use(async (context, next) =>
{
    context.TraceIdentifier = context.Request.Headers.TryGetValue("X-Request-ID", out var requestId) && requestId.Count == 1 && requestId[0] is { Length: > 0 and <= 100 } value ? value : Guid.CreateVersion7().ToString("N");
    context.Response.Headers["X-Content-Type-Options"] = "nosniff";
    context.Response.Headers["X-Frame-Options"] = "DENY";
    context.Response.Headers["Referrer-Policy"] = "strict-origin-when-cross-origin";
    context.Response.Headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()";
    context.Response.Headers["Cross-Origin-Opener-Policy"] = "same-origin";
    context.Response.Headers["X-Request-ID"] = context.TraceIdentifier;
    await next();
});
if (!app.Environment.IsDevelopment())
{
    app.UseHsts();
    app.UseHttpsRedirection();
}
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}
app.UseSerilogRequestLogging(options => options.MessageTemplate = "HTTP {RequestMethod} {RequestPath} responded {StatusCode} in {Elapsed:0.0000} ms");
app.UseCors("storefront");
app.UseRateLimiter();
app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();
app.MapHealthChecks("/health/live", new HealthCheckOptions { Predicate = _ => false });
app.MapHealthChecks("/health/ready", new HealthCheckOptions { Predicate = check => check.Tags.Contains("ready") });

if (app.Environment.IsDevelopment() || app.Environment.IsStaging())
{
    await using var scope = app.Services.CreateAsyncScope();
    var db = scope.ServiceProvider.GetRequiredService<StoreDbContext>();
    await db.Database.MigrateAsync();
    await EnsureRolesAsync(scope.ServiceProvider);
    await EnsureDevelopmentAdminAsync(scope.ServiceProvider, builder.Configuration);
    await StoreDbContextSeed.SeedAsync(db, CancellationToken.None);
}

await app.RunAsync();

static async Task EnsureRolesAsync(IServiceProvider services)
{
    var roleManager = services.GetRequiredService<RoleManager<IdentityRole<Guid>>>();
    foreach (var role in new[] { "Customer", "Admin", "CatalogManager", "InventoryManager", "OrderManager", "SupportAgent", "ContentEditor", "ContentPublisher", "ContentAdministrator" })
        if (!await roleManager.RoleExistsAsync(role)) await roleManager.CreateAsync(new IdentityRole<Guid>(role));
}

static async Task EnsureDevelopmentAdminAsync(IServiceProvider services, IConfiguration configuration)
{
    var email = configuration["SeedAdmin:Email"]?.Trim().ToLowerInvariant();
    var password = configuration["SeedAdmin:Password"];
    if (string.IsNullOrWhiteSpace(email) || string.IsNullOrWhiteSpace(password)) return;
    var users = services.GetRequiredService<UserManager<ApplicationUser>>();
    var user = await users.FindByEmailAsync(email);
    if (user is null)
    {
        user = new ApplicationUser { Id = Guid.CreateVersion7(), UserName = email, Email = email, EmailConfirmed = true, FirstName = "Admin", LastName = "Local" };
        var result = await users.CreateAsync(user, password);
        if (!result.Succeeded) throw new InvalidOperationException("No se pudo crear el administrador local: " + string.Join(", ", result.Errors.Select(x => x.Code)));
    }
    if (!await users.IsInRoleAsync(user, "Admin")) await users.AddToRoleAsync(user, "Admin");
}

static void ValidateProductionConfiguration(IConfiguration configuration)
{
    var errors = new List<string>();
    var connection = configuration.GetConnectionString("DefaultConnection") ?? string.Empty;
    if (string.IsNullOrWhiteSpace(connection) || !connection.Contains("SSL Mode=Require", StringComparison.OrdinalIgnoreCase) && !connection.Contains("SSL Mode=VerifyFull", StringComparison.OrdinalIgnoreCase)) errors.Add("PostgreSQL debe tener conexión y SSL obligatorio.");
    var publicUrl = configuration["App:PublicUrl"] ?? string.Empty;
    if (!Uri.TryCreate(publicUrl, UriKind.Absolute, out var publicUri) || publicUri.Scheme != Uri.UriSchemeHttps || publicUri.Host.Contains("example", StringComparison.OrdinalIgnoreCase)) errors.Add("App:PublicUrl debe ser la URL HTTPS real.");
    var origins = configuration.GetSection("App:AllowedOrigins").Get<string[]>() ?? [];
    if (origins.Length == 0 || origins.Any(origin => !Uri.TryCreate(origin, UriKind.Absolute, out var uri) || uri.Scheme != Uri.UriSchemeHttps || uri.Host.Contains("example", StringComparison.OrdinalIgnoreCase))) errors.Add("AllowedOrigins debe contener sólo orígenes HTTPS reales.");
    var signingKey = configuration["Auth:SigningKey"] ?? string.Empty;
    if (signingKey.Length < 64 || signingKey.Contains("replace", StringComparison.OrdinalIgnoreCase) || signingKey.Contains("development", StringComparison.OrdinalIgnoreCase)) errors.Add("Auth:SigningKey debe ser un secreto aleatorio de al menos 64 caracteres.");
    if (!string.Equals(configuration["Transbank:Environment"], "Production", StringComparison.OrdinalIgnoreCase) || string.IsNullOrWhiteSpace(configuration["Transbank:CommerceCode"]) || string.IsNullOrWhiteSpace(configuration["Transbank:ApiKey"]) || !Uri.TryCreate(configuration["Transbank:ReturnUrl"], UriKind.Absolute, out var returnUri) || returnUri.Scheme != Uri.UriSchemeHttps) errors.Add("Transbank debe usar credenciales y retorno HTTPS de producción.");
    if (!string.Equals(configuration["Resend:Mode"], "Resend", StringComparison.OrdinalIgnoreCase) || string.IsNullOrWhiteSpace(configuration["Resend:ApiKey"]) || configuration["Resend:FromEmail"]?.Contains('@') != true) errors.Add("Resend debe tener API key y remitente verificado.");
    if (!Uri.TryCreate(configuration["Supabase:Url"], UriKind.Absolute, out var supabaseUri) || supabaseUri.Scheme != Uri.UriSchemeHttps || string.IsNullOrWhiteSpace(configuration["Supabase:ServiceRoleKey"])) errors.Add("Supabase Storage debe tener URL HTTPS y service role secret.");
    var allowedHosts = configuration["AllowedHosts"] ?? string.Empty;
    if (allowedHosts.Contains('*') || allowedHosts.Contains("example", StringComparison.OrdinalIgnoreCase)) errors.Add("AllowedHosts debe contener sólo hosts reales.");
    if (errors.Count > 0) throw new InvalidOperationException("Configuración de producción insegura: " + string.Join(" ", errors));
}

public partial class Program;
