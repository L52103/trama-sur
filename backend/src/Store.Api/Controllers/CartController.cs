using System.Security.Cryptography;
using Microsoft.AspNetCore.Mvc;
using Microsoft.IdentityModel.Tokens;
using Store.Application.Cart;

namespace Store.Api.Controllers;

[ApiController]
[Route("api/v1/cart")]
public sealed class CartController(ICartService cartService, IWebHostEnvironment environment) : ControllerBase
{
    [HttpGet]
    public Task<CartDto> Get(CancellationToken cancellationToken) => cartService.GetAsync(GetOrCreateCartToken(), cancellationToken);

    [HttpPost("items")]
    public Task<CartDto> Add(AddCartItemRequest request, CancellationToken cancellationToken) => cartService.AddAsync(GetOrCreateCartToken(), request, cancellationToken);

    [HttpPut("items/{itemId:guid}")]
    public Task<CartDto> Update(Guid itemId, UpdateCartItemRequest request, CancellationToken cancellationToken) => cartService.UpdateAsync(GetOrCreateCartToken(), itemId, request, cancellationToken);

    [HttpDelete("items/{itemId:guid}")]
    public Task<CartDto> Remove(Guid itemId, CancellationToken cancellationToken) => cartService.RemoveAsync(GetOrCreateCartToken(), itemId, cancellationToken);

    [HttpPost("apply-coupon")]
    public Task<CartDto> ApplyCoupon(ApplyCouponRequest request, CancellationToken cancellationToken) => cartService.ApplyCouponAsync(GetOrCreateCartToken(), request.Code, cancellationToken);

    [HttpDelete("coupon")]
    public Task<CartDto> RemoveCoupon(CancellationToken cancellationToken) => cartService.RemoveCouponAsync(GetOrCreateCartToken(), cancellationToken);

    private string GetOrCreateCartToken()
    {
        var cookieName = environment.IsDevelopment() ? "trama_cart" : "__Host-trama_cart";
        if (Request.Cookies.TryGetValue(cookieName, out var existing) && !string.IsNullOrWhiteSpace(existing)) return existing;
        var token = Base64UrlEncoder.Encode(RandomNumberGenerator.GetBytes(48));
        Response.Cookies.Append(cookieName, token, new CookieOptions { HttpOnly = true, Secure = !environment.IsDevelopment(), SameSite = SameSiteMode.Lax, Path = "/", MaxAge = TimeSpan.FromDays(30), IsEssential = true });
        return token;
    }
}
