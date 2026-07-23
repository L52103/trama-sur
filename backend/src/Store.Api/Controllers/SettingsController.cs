using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Store.Infrastructure.Persistence;

namespace Store.Api.Controllers;

[ApiController]
[Route("api/v1/settings")]
public class SettingsController : ControllerBase
{
    private readonly StoreDbContext _db;

    public SettingsController(StoreDbContext db)
    {
        _db = db;
    }

    [HttpGet]
    public async Task<IActionResult> GetSettings()
    {
        var settings = await _db.StoreSettings.ToListAsync();
        var dict = settings.ToDictionary(x => x.Key, x => x.Value);
        
        if (!dict.ContainsKey("darkMode")) dict["darkMode"] = "false";
        if (!dict.ContainsKey("storeName")) dict["storeName"] = "TRAMA SUR";
        if (!dict.ContainsKey("storeLogo")) dict["storeLogo"] = "";

        return Ok(dict);
    }
}
