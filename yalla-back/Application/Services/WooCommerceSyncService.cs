using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Yalla.Application.Abstractions;
using Yalla.Application.DTO.Request;
using Yalla.Domain.Entities;
using Yalla.Application.Common;

namespace Yalla.Application.Services;

public sealed class WooCommerceSyncService : IWooCommerceSyncService
{
    private readonly IAppDbContext _dbContext;
    private readonly WooCommerceOptions _options;
    private readonly HttpClient _httpClient;
    private readonly ILogger<WooCommerceSyncService> _logger;
    private DateTime _lastPollUtc = DateTime.MinValue;

    public WooCommerceSyncService(
        IAppDbContext dbContext,
        IOptions<WooCommerceOptions> options,
        HttpClient httpClient,
        ILogger<WooCommerceSyncService> logger)
    {
        _dbContext = dbContext;
        _options = options.Value;
        _httpClient = httpClient;
        _logger = logger;
    }

    public async Task ProcessWebhookAsync(WooCommerceWebhookPayload payload, CancellationToken cancellationToken = default)
    {
        if (payload.Id <= 0) return;

        var medicine = await _dbContext.Medicines
            .AsTracking()
            .FirstOrDefaultAsync(x => x.WooCommerceId == payload.Id, cancellationToken);

        if (medicine == null)
        {
            _logger.LogWarning("Webhook: Medicine not found for WooCommerceId {WcId}", payload.Id);
            return;
        }

        await UpsertOfferAsync(medicine.Id, payload.Price, payload.StockQuantity, payload.StockStatus, cancellationToken);

        // Update title if changed
        if (!string.IsNullOrWhiteSpace(payload.Name) && payload.Name != medicine.Title)
            medicine.SetTitle(payload.Name);

        // Deactivate if product unpublished
        if (payload.Status == "trash" || payload.Status == "draft")
            medicine.SetIsActive(false);
        else if (payload.Status == "publish" && !medicine.IsActive)
            medicine.SetIsActive(true);

        await _dbContext.SaveChangesAsync(cancellationToken);
        _logger.LogInformation("Webhook: Synced WC:{WcId} → Medicine {MedicineId}, price={Price}, stock={Stock}",
            payload.Id, medicine.Id, payload.Price, payload.StockQuantity);
    }

    public async Task PollUpdatedProductsAsync(CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(_options.BaseUrl) || string.IsNullOrWhiteSpace(_options.ConsumerKey))
        {
            _logger.LogWarning("WooCommerce polling skipped: BaseUrl or ConsumerKey not configured");
            return;
        }

        var modifiedAfter = _lastPollUtc > DateTime.MinValue
            ? _lastPollUtc.ToString("yyyy-MM-ddTHH:mm:ss")
            : "";

        var pollStart = DateTime.UtcNow;
        int page = 1;
        int totalSynced = 0;

        while (!cancellationToken.IsCancellationRequested)
        {
            var url = $"{_options.BaseUrl}/wp-json/wc/v3/products?per_page=100&page={page}" +
                      $"&consumer_key={_options.ConsumerKey}&consumer_secret={_options.ConsumerSecret}";

            if (!string.IsNullOrEmpty(modifiedAfter))
                url += $"&modified_after={modifiedAfter}";

            try
            {
                var response = await _httpClient.GetAsync(url, cancellationToken);
                if (!response.IsSuccessStatusCode)
                {
                    _logger.LogWarning("WC Poll: HTTP {StatusCode} on page {Page}", response.StatusCode, page);
                    break;
                }

                var json = await response.Content.ReadAsStringAsync(cancellationToken);
                var products = JsonSerializer.Deserialize<List<WooCommerceWebhookPayload>>(json);

                if (products == null || products.Count == 0) break;

                foreach (var product in products)
                {
                    try
                    {
                        var medicine = await _dbContext.Medicines
                            .AsTracking()
                            .FirstOrDefaultAsync(x => x.WooCommerceId == product.Id, cancellationToken);

                        if (medicine == null) continue;

                        await UpsertOfferAsync(medicine.Id, product.Price, product.StockQuantity, product.StockStatus, cancellationToken);
                        totalSynced++;
                    }
                    catch (Exception ex)
                    {
                        _logger.LogError(ex, "WC Poll: Failed to sync product {WcId}", product.Id);
                    }
                }

                await _dbContext.SaveChangesAsync(cancellationToken);

                if (response.Headers.TryGetValues("X-WP-TotalPages", out var tp) &&
                    int.TryParse(tp.First(), out int totalPages) && page >= totalPages)
                    break;

                page++;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "WC Poll: Error on page {Page}", page);
                break;
            }
        }

        _lastPollUtc = pollStart;
        _logger.LogInformation("WC Poll: Synced {Count} products", totalSynced);
    }

    private async Task UpsertOfferAsync(Guid medicineId, string priceStr, int? stockQty, string stockStatus, CancellationToken ct)
    {
        var pharmacyId = _options.PharmacyId;
        if (pharmacyId == Guid.Empty) return;

        decimal.TryParse(priceStr, System.Globalization.NumberStyles.Any,
            System.Globalization.CultureInfo.InvariantCulture, out var price);

        var stock = stockStatus == "outofstock" ? 0 : stockQty ?? (stockStatus == "instock" ? 1 : 0);

        var offer = await _dbContext.Offers
            .AsTracking()
            .FirstOrDefaultAsync(x => x.MedicineId == medicineId && x.PharmacyId == pharmacyId, ct);

        if (offer != null)
        {
            offer.SetPrice(price);
            offer.SetStockQuantity(stock);
        }
        else
        {
            var newOffer = new Offer(medicineId, pharmacyId, stock, price);
            _dbContext.Offers.Add(newOffer);
        }
    }
}
