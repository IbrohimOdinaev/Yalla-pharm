using System.Text.Json.Serialization;

namespace Yalla.Application.DTO.Request;

public sealed class WooCommerceWebhookPayload
{
    [JsonPropertyName("id")]
    public int Id { get; set; }

    [JsonPropertyName("price")]
    public string Price { get; set; } = string.Empty;

    [JsonPropertyName("stock_quantity")]
    public int? StockQuantity { get; set; }

    [JsonPropertyName("stock_status")]
    public string StockStatus { get; set; } = string.Empty;

    [JsonPropertyName("status")]
    public string Status { get; set; } = string.Empty;

    /// <summary>
    /// WooCommerce product display name. Used as a fallback medicine title
    /// when our `Title` is missing/stale; webhook payloads always include it.
    /// </summary>
    [JsonPropertyName("name")]
    public string? Name { get; set; }

    /// <summary>
    /// URL slug (kebab-case, latin) — copied 1:1 into Medicine.Slug for SEO
    /// routes. WooCommerce guarantees uniqueness within the WP site.
    /// </summary>
    [JsonPropertyName("slug")]
    public string? Slug { get; set; }
}
