using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Store.Domain.Entities;
using Store.Infrastructure.Persistence;

namespace Store.Api.Controllers;

[ApiController]
[Route("api/v1/admin/settings")]
[Authorize(Policy = "CatalogWrite")] // Using an existing admin policy for settings for now
public class AdminSettingsController : ControllerBase
{
    private readonly StoreDbContext _db;

    public AdminSettingsController(StoreDbContext db)
    {
        _db = db;
    }

    [HttpGet]
    public async Task<IActionResult> GetSettings()
    {
        var settings = await _db.StoreSettings.ToListAsync();
        var dict = settings.ToDictionary(x => x.Key, x => x.Value);
        
        // Ensure defaults exist for the frontend to consume
        if (!dict.ContainsKey("darkMode")) dict["darkMode"] = "false";
        if (!dict.ContainsKey("storeName")) dict["storeName"] = "TRAMA SUR";
        if (!dict.ContainsKey("storeLogo")) dict["storeLogo"] = "";

        return Ok(dict);
    }

    [HttpPut]
    public async Task<IActionResult> SaveSettings([FromBody] Dictionary<string, string> dto)
    {
        var existing = await _db.StoreSettings.ToListAsync();
        
        foreach (var (key, value) in dto)
        {
            var setting = existing.FirstOrDefault(x => x.Key == key);
            if (setting == null)
            {
                _db.StoreSettings.Add(new StoreSetting { Key = key, Value = value });
            }
            else
            {
                setting.Value = value;
            }
        }
        
        await _db.SaveChangesAsync();
        return Ok(dto);
    }
}
