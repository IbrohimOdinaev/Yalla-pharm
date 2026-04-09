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
        // Wait for Elasticsearch to be ready
        await Task.Delay(TimeSpan.FromSeconds(30), stoppingToken);

        for (var attempt = 0; attempt < 10; attempt++)
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
                _logger.LogWarning(ex, "Elasticsearch reindex attempt {Attempt} failed: {Message}, retrying in 15s", attempt + 1, ex.Message);
                await Task.Delay(TimeSpan.FromSeconds(15), stoppingToken);
            }
        }

        _logger.LogError("Elasticsearch reindex failed after 10 attempts");
    }
}
