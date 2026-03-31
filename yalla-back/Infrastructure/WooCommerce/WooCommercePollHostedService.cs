using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Yalla.Application.Common;
using Yalla.Application.Services;

namespace Yalla.Infrastructure.WooCommerce;

public sealed class WooCommercePollHostedService : BackgroundService
{
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly WooCommerceOptions _options;
    private readonly ILogger<WooCommercePollHostedService> _logger;

    public WooCommercePollHostedService(
        IServiceScopeFactory scopeFactory,
        IOptions<WooCommerceOptions> options,
        ILogger<WooCommercePollHostedService> logger)
    {
        _scopeFactory = scopeFactory;
        _options = options.Value;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        if (string.IsNullOrWhiteSpace(_options.BaseUrl))
        {
            _logger.LogInformation("WooCommerce polling disabled: BaseUrl not configured");
            return;
        }

        var interval = TimeSpan.FromMinutes(Math.Max(_options.PollIntervalMinutes, 1));
        _logger.LogInformation("WooCommerce polling started, interval: {Interval}", interval);

        // Initial delay to let the app start
        await Task.Delay(TimeSpan.FromSeconds(30), stoppingToken);

        // First run: full sync (no modified_after filter)
        await RunPollAsync(stoppingToken);

        while (!stoppingToken.IsCancellationRequested)
        {
            await Task.Delay(interval, stoppingToken);
            await RunPollAsync(stoppingToken);
        }
    }

    private async Task RunPollAsync(CancellationToken stoppingToken)
    {
        try
        {
            using var scope = _scopeFactory.CreateScope();
            var syncService = scope.ServiceProvider.GetRequiredService<IWooCommerceSyncService>();
            await syncService.PollUpdatedProductsAsync(stoppingToken);
        }
        catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
        {
            // Shutdown — ignore
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "WooCommerce poll failed");
        }
    }
}
