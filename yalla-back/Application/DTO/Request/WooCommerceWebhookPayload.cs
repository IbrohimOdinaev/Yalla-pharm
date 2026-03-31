using System.Text.Json.Serialization;

namespace Yalla.Application.DTO.Request;

public sealed class WooCommerceWebhookPayload
{
    [JsonPropertyName("id")]
    public int Id { get; set; }

    [JsonPropertyName("name")]
    public string Name { get; set; } = string.Empty;

    [JsonPropertyName("price")]
    public string Price { get; set; } = string.Empty;

    [JsonPropertyName("regular_price")]
    public string RegularPrice { get; set; } = string.Empty;

    [JsonPropertyName("stock_quantity")]
    public int? StockQuantity { get; set; }

    [JsonPropertyName("stock_status")]
    public string StockStatus { get; set; } = string.Empty;

    [JsonPropertyName("status")]
    public string Status { get; set; } = string.Empty;
}
