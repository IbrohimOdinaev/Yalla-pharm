using Yalla.Application.DTO.Request;

namespace Yalla.Application.Services;

public interface IWooCommerceSyncService
{
    Task ProcessWebhookAsync(WooCommerceWebhookPayload payload, CancellationToken cancellationToken = default);
    Task PollUpdatedProductsAsync(CancellationToken cancellationToken = default);
}
