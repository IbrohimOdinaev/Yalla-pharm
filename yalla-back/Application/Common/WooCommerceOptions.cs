namespace Yalla.Application.Common;

public sealed class WooCommerceOptions
{
    public const string SectionName = "WooCommerce";

    public string BaseUrl { get; set; } = string.Empty;
    public string ConsumerKey { get; set; } = string.Empty;
    public string ConsumerSecret { get; set; } = string.Empty;
    public string WebhookSecret { get; set; } = string.Empty;
    public Guid PharmacyId { get; set; } = Guid.Empty;
    public int PollIntervalMinutes { get; set; } = 10;
}
