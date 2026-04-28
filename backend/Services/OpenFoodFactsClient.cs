using System.Globalization;
using System.Text.Json;
using Microsoft.Extensions.Caching.Memory;

public class OpenFoodFactsClient
{
    private readonly HttpClient _http;
    private readonly IMemoryCache _cache;

    public OpenFoodFactsClient(HttpClient http, IMemoryCache cache)
    {
        _http = http;
        _http.DefaultRequestHeaders.UserAgent.ParseAdd("Jinsei/1.0 (wegerernikolas@gmail.com)");
        _cache = cache;
    }

    public async Task<List<OffProduct>> SearchAsync(string query)
    {
        var key = $"off:search:{query.ToLower()}";
        if (_cache.TryGetValue(key, out List<OffProduct>? cached)) return cached!;

        var url = $"https://world.openfoodfacts.org/api/v2/search?search_terms={Uri.EscapeDataString(query)}&page_size=20&fields=code,product_name,brands,nutriments,serving_size&sort_by=unique_scans_n";
        using var res = await _http.GetAsync(url);
        if (!res.IsSuccessStatusCode) return [];

        using var doc = JsonDocument.Parse(await res.Content.ReadAsStringAsync());
        var products = doc.RootElement
            .GetProperty("products")
            .EnumerateArray()
            .Select(ParseProduct)
            .Where(p => p is not null)
            .Cast<OffProduct>()
            .ToList();

        _cache.Set(key, products, TimeSpan.FromHours(1));
        return products;
    }

    public async Task<OffProduct?> GetByBarcodeAsync(string barcode)
    {
        var key = $"off:barcode:{barcode}";
        if (_cache.TryGetValue(key, out OffProduct? cached)) return cached;

        var url = $"https://world.openfoodfacts.org/api/v2/product/{barcode}.json?fields=code,product_name,brands,nutriments,serving_size";
        using var res = await _http.GetAsync(url);
        if (!res.IsSuccessStatusCode) return null;

        using var doc = JsonDocument.Parse(await res.Content.ReadAsStringAsync());
        if (!doc.RootElement.TryGetProperty("product", out var productEl)) return null;

        var product = ParseProduct(productEl);
        if (product is not null) _cache.Set(key, product, TimeSpan.FromDays(1));
        return product;
    }

    private static OffProduct? ParseProduct(JsonElement el)
    {
        if (!el.TryGetProperty("product_name", out var nameEl)) return null;
        var name = nameEl.GetString();
        if (string.IsNullOrWhiteSpace(name)) return null;

        el.TryGetProperty("nutriments", out var nut);
        decimal kcal = GetDecimal(nut, "energy-kcal_100g") ?? GetDecimal(nut, "energy_100g") / 4.184m ?? 0;

        return new OffProduct(
            el.TryGetProperty("code", out var code) ? code.GetString() : null,
            name,
            el.TryGetProperty("brands", out var brands) ? brands.GetString() : null,
            kcal,
            GetDecimal(nut, "proteins_100g") ?? 0,
            GetDecimal(nut, "carbohydrates_100g") ?? 0,
            GetDecimal(nut, "fat_100g") ?? 0,
            GetDecimal(nut, "fiber_100g"),
            el.TryGetProperty("serving_size", out var ss) ? ParseServingGrams(ss.GetString()) : null
        );
    }

    private static decimal? GetDecimal(JsonElement el, string key)
    {
        if (!el.ValueKind.Equals(JsonValueKind.Object)) return null;
        if (!el.TryGetProperty(key, out var val)) return null;
        return val.ValueKind switch
        {
            JsonValueKind.Number => val.GetDecimal(),
            JsonValueKind.String => decimal.TryParse(val.GetString(), NumberStyles.Number, CultureInfo.InvariantCulture, out var d) ? d : null,
            _ => null,
        };
    }

    private static decimal? ParseServingGrams(string? s)
    {
        if (s is null) return null;
        var match = System.Text.RegularExpressions.Regex.Match(s, @"(\d+(?:\.\d+)?)\s*g");
        return match.Success ? decimal.Parse(match.Groups[1].Value, CultureInfo.InvariantCulture) : null;
    }
}

public record OffProduct(
    string? Barcode,
    string Name,
    string? Brand,
    decimal KcalPer100g,
    decimal ProteinPer100g,
    decimal CarbsPer100g,
    decimal FatPer100g,
    decimal? FiberPer100g,
    decimal? ServingSizeG
);
