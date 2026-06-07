using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Yalla.Application.Abstractions;

namespace Yalla.Infrastructure.Search;

public sealed class ElasticsearchReindexHostedService : BackgroundService
{
    private readonly IServiceProvider _services;
    private readonly ILogger<ElasticsearchReindexHostedService> _logger;

    public ElasticsearchReindexHostedService(IServiceProvider services, ILogger<ElasticsearchReindexHostedService> logger)
    {
        _services = services;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        // Wait for OpenSearch to join the Docker network and finish warming
        // up. The compose healthcheck can pass before DNS/socket pressure on a
        // small VPS has settled, so keep this worker patient and let the API
        // serve SQL-backed search meanwhile.
        await Task.Delay(TimeSpan.FromSeconds(30), stoppingToken);

        const int maxAttempts = 40;
        for (var attempt = 0; attempt < maxAttempts; attempt++)
        {
            try
            {
                using var scope = _services.CreateScope();
                var searchEngine = scope.ServiceProvider.GetRequiredService<IMedicineSearchEngine>();
                await searchEngine.ReindexAllAsync(stoppingToken);
                _logger.LogInformation("Elasticsearch reindex completed successfully");
                return;
            }
            catch (Exception ex)
            {
                _logger.LogWarning(
                    ex,
                    "Elasticsearch reindex attempt {Attempt}/{MaxAttempts} failed: {Message}, retrying in 15s",
                    attempt + 1,
                    maxAttempts,
                    ex.Message);
                await Task.Delay(TimeSpan.FromSeconds(15), stoppingToken);
            }
        }

        _logger.LogWarning("Elasticsearch unavailable — live search will use SQL fallback");
    }
}
