using Yalla.Application;
using Yalla.Domain.AuxiliaryEntities;
using Yalla.Domain.Entities;

namespace Yalla.Api.IntegrationTests.Fixtures;

internal sealed class NoOpTelegramService : ITelegramService
{
    public Task SendAsync(MessageBase message, CancellationToken cancellationToken = default)
        => Task.CompletedTask;
}

internal sealed class NoOpImageRepository : IImageRepository
{
    public Task<string?> SaveImageAsync(string imagePath, CancellationToken cancellationToken = default)
        => Task.FromResult<string?>("https://integration-tests.local/fake-image.jpg");
}

internal sealed class NoOpDeliveryRepository : IDeliveryRepository
{
    public Task<bool> SendAsync(DeliveryRequest entity, CancellationToken cancellationToken = default)
        => Task.FromResult(true);

    public Task<bool> UpdateAsync(DeliveryRequest entity, CancellationToken cancellationToken = default)
        => Task.FromResult(true);
}
