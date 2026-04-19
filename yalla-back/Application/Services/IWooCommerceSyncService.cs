using Yalla.Application.DTO.Request;

namespace Yalla.Application.Services;

public interface IWooCommerceSyncService
{
    Task ProcessUpdateAsync(WooCommerceWebhookPayload payload, CancellationToken cancellationToken = default);
    Task ProcessDeleteAsync(int wooCommerceId, CancellationToken cancellationToken = default);
    Task PollUpdatedProductsAsync(CancellationToken cancellationToken = default);
}
