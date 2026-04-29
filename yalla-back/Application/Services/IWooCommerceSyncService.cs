using Yalla.Application.DTO.Request;

namespace Yalla.Application.Services;

public interface IWooCommerceSyncService
{
    Task ProcessUpdateAsync(WooCommerceWebhookPayload payload, CancellationToken cancellationToken = default);
    Task ProcessDeleteAsync(int wooCommerceId, CancellationToken cancellationToken = default);
    Task PollUpdatedProductsAsync(CancellationToken cancellationToken = default);

    /// <summary>
    /// One-shot full-catalog sweep: paginates through every WC product (no
    /// modified_after cursor) and writes title/slug onto matching medicines.
    /// Used to backfill the slug column once after migration. Returns number
    /// of medicines updated.
    /// </summary>
    Task<int> BackfillCatalogAsync(CancellationToken cancellationToken = default);
}
