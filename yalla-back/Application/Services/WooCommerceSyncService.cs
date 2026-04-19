using System.Globalization;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Yalla.Application.Abstractions;
using Yalla.Application.Common;
using Yalla.Application.DTO.Request;
using Yalla.Domain.Entities;

namespace Yalla.Application.Services;

public sealed class WooCommerceSyncService : IWooCommerceSyncService
{
    private const string PollCursorKey = "woocommerce_products_last_poll_utc";

    private readonly IAppDbContext _dbContext;
    private readonly WooCommerceOptions _options;
    private readonly HttpClient _httpClient;
    private readonly ILogger<WooCommerceSyncService> _logger;

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

    public async Task ProcessUpdateAsync(WooCommerceWebhookPayload payload, CancellationToken cancellationToken = default)
    {
        if (payload.Id <= 0) return;

        var medicineId = await _dbContext.Medicines
            .Where(x => x.WooCommerceId == payload.Id)
            .Select(x => (Guid?)x.Id)
            .FirstOrDefaultAsync(cancellationToken);

        if (medicineId is null)
        {
            _logger.LogWarning("Webhook: Medicine not found for WooCommerceId {WcId}", payload.Id);
            return;
        }

        if (!TryComputeStock(payload, out var stock))
        {
            _logger.LogWarning("Webhook: WC:{WcId} skipped — invalid stock_quantity", payload.Id);
            return;
        }

        if (!TryParsePrice(payload.Price, out var price))
        {
            _logger.LogWarning("Webhook: WC:{WcId} skipped — invalid price '{Price}'", payload.Id, payload.Price);
            return;
        }

        await UpsertOfferAsync(medicineId.Value, price, stock, cancellationToken);
        await _dbContext.SaveChangesAsync(cancellationToken);

        _logger.LogInformation("Webhook update: WC:{WcId} → Medicine {MedicineId}, price={Price}, stock={Stock}",
            payload.Id, medicineId.Value, price, stock);
    }

    public async Task ProcessDeleteAsync(int wooCommerceId, CancellationToken cancellationToken = default)
    {
        if (wooCommerceId <= 0) return;

        var pharmacyId = _options.PharmacyId;
        if (pharmacyId == Guid.Empty) return;

        var offer = await (
            from m in _dbContext.Medicines
            join o in _dbContext.Offers on m.Id equals o.MedicineId
            where m.WooCommerceId == wooCommerceId && o.PharmacyId == pharmacyId
            select o).AsTracking().FirstOrDefaultAsync(cancellationToken);

        if (offer is null)
        {
            _logger.LogInformation("Webhook delete: WC:{WcId} — no offer to zero", wooCommerceId);
            return;
        }

        offer.SetStockQuantity(0);
        await _dbContext.SaveChangesAsync(cancellationToken);

        _logger.LogInformation("Webhook delete: WC:{WcId} → offer stock set to 0", wooCommerceId);
    }

    public async Task PollUpdatedProductsAsync(CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(_options.BaseUrl) || string.IsNullOrWhiteSpace(_options.ConsumerKey))
        {
            _logger.LogWarning("WooCommerce polling skipped: BaseUrl or ConsumerKey not configured");
            return;
        }

        if (_options.PharmacyId == Guid.Empty)
        {
            _logger.LogWarning("WooCommerce polling skipped: PharmacyId not configured");
            return;
        }

        var cursor = await LoadCursorAsync(cancellationToken);
        var modifiedAfter = cursor > DateTime.MinValue
            ? cursor.ToString("yyyy-MM-ddTHH:mm:ss", CultureInfo.InvariantCulture)
            : "";

        var pollStart = DateTime.UtcNow;
        int page = 1;
        int totalSynced = 0;
        bool succeeded = true;

        while (!cancellationToken.IsCancellationRequested)
        {
            var url = $"{_options.BaseUrl}/wp-json/wc/v3/products?per_page=100&page={page}";
            if (!string.IsNullOrEmpty(modifiedAfter))
                url += $"&modified_after={modifiedAfter}";

            try
            {
                var response = await _httpClient.GetAsync(url, cancellationToken);
                if (!response.IsSuccessStatusCode)
                {
                    _logger.LogWarning("WC Poll: HTTP {StatusCode} on page {Page}", response.StatusCode, page);
                    succeeded = false;
                    break;
                }

                var json = await response.Content.ReadAsStringAsync(cancellationToken);
                var products = JsonSerializer.Deserialize<List<WooCommerceWebhookPayload>>(json);

                if (products == null || products.Count == 0) break;

                totalSynced += await SyncBatchAsync(products, cancellationToken);

                if (response.Headers.TryGetValues("X-WP-TotalPages", out var tp) &&
                    int.TryParse(tp.First(), out int totalPages) && page >= totalPages)
                    break;

                page++;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "WC Poll: Error on page {Page}", page);
                succeeded = false;
                break;
            }
        }

        if (succeeded)
            await SaveCursorAsync(pollStart, cancellationToken);

        _logger.LogInformation("WC Poll: Synced {Count} products (succeeded={Succeeded})", totalSynced, succeeded);
    }

    private async Task<int> SyncBatchAsync(List<WooCommerceWebhookPayload> products, CancellationToken ct)
    {
        var pharmacyId = _options.PharmacyId;
        var ids = products.Where(p => p.Id > 0).Select(p => p.Id).Distinct().ToList();
        if (ids.Count == 0) return 0;

        var medicines = await _dbContext.Medicines
            .Where(m => m.WooCommerceId.HasValue && ids.Contains(m.WooCommerceId.Value))
            .Select(m => new { m.Id, WcId = m.WooCommerceId!.Value })
            .ToDictionaryAsync(x => x.WcId, x => x.Id, ct);

        if (medicines.Count == 0) return 0;

        var medicineIds = medicines.Values.ToList();
        var offers = await _dbContext.Offers
            .AsTracking()
            .Where(o => o.PharmacyId == pharmacyId && medicineIds.Contains(o.MedicineId))
            .ToDictionaryAsync(o => o.MedicineId, ct);

        int synced = 0;
        foreach (var product in products)
        {
            if (!medicines.TryGetValue(product.Id, out var medicineId)) continue;

            if (!TryComputeStock(product, out var stock))
            {
                _logger.LogWarning("WC Poll: WC:{WcId} skipped — invalid stock_quantity", product.Id);
                continue;
            }

            if (!TryParsePrice(product.Price, out var price))
            {
                _logger.LogWarning("WC Poll: WC:{WcId} skipped — invalid price '{Price}'", product.Id, product.Price);
                continue;
            }

            if (offers.TryGetValue(medicineId, out var offer))
            {
                offer.SetPrice(price);
                offer.SetStockQuantity(stock);
            }
            else
            {
                var newOffer = new Offer(medicineId, pharmacyId, stock, price);
                _dbContext.Offers.Add(newOffer);
                offers[medicineId] = newOffer;
            }
            synced++;
        }

        await _dbContext.SaveChangesAsync(ct);
        return synced;
    }

    private async Task UpsertOfferAsync(Guid medicineId, decimal price, int stock, CancellationToken ct)
    {
        var pharmacyId = _options.PharmacyId;
        if (pharmacyId == Guid.Empty) return;

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
            _dbContext.Offers.Add(new Offer(medicineId, pharmacyId, stock, price));
        }
    }

    private async Task<DateTime> LoadCursorAsync(CancellationToken ct)
    {
        var raw = await _dbContext.SyncStates
            .Where(x => x.Key == PollCursorKey)
            .Select(x => x.Value)
            .FirstOrDefaultAsync(ct);

        if (string.IsNullOrEmpty(raw)) return DateTime.MinValue;
        return DateTime.TryParse(raw, CultureInfo.InvariantCulture,
            DateTimeStyles.AssumeUniversal | DateTimeStyles.AdjustToUniversal, out var dt)
            ? DateTime.SpecifyKind(dt, DateTimeKind.Utc)
            : DateTime.MinValue;
    }

    private async Task SaveCursorAsync(DateTime utc, CancellationToken ct)
    {
        var value = utc.ToString("o", CultureInfo.InvariantCulture);
        var existing = await _dbContext.SyncStates
            .AsTracking()
            .FirstOrDefaultAsync(x => x.Key == PollCursorKey, ct);

        if (existing is null)
            _dbContext.SyncStates.Add(new SyncState(PollCursorKey, value, utc));
        else
            existing.SetValue(value, utc);

        await _dbContext.SaveChangesAsync(ct);
    }

    private static bool TryComputeStock(WooCommerceWebhookPayload p, out int stock)
    {
        // Unpublished products are treated as out of stock to protect the catalog.
        if (p.Status is "trash" or "draft" or "pending")
        {
            stock = 0;
            return true;
        }

        if (p.StockStatus == "outofstock")
        {
            stock = 0;
            return true;
        }

        if (p.StockQuantity.HasValue)
        {
            if (p.StockQuantity.Value < 0) { stock = 0; return false; }
            stock = p.StockQuantity.Value;
            return true;
        }

        stock = p.StockStatus == "instock" ? 1 : 0;
        return true;
    }

    private static bool TryParsePrice(string raw, out decimal price)
    {
        if (string.IsNullOrWhiteSpace(raw)) { price = 0; return false; }
        if (!decimal.TryParse(raw, NumberStyles.Any, CultureInfo.InvariantCulture, out price)) return false;
        if (price < 0) return false;
        return true;
    }
}
