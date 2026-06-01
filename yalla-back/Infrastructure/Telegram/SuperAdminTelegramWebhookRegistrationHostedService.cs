using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Yalla.Application.Abstractions;
using Yalla.Application.Common;

namespace Yalla.Infrastructure.Telegram;

public sealed class SuperAdminTelegramWebhookRegistrationHostedService : IHostedService
{
  private readonly ISuperAdminTelegramBotApi _botApi;
  private readonly SuperAdminTelegramNotificationOptions _options;
  private readonly ILogger<SuperAdminTelegramWebhookRegistrationHostedService> _logger;

  public SuperAdminTelegramWebhookRegistrationHostedService(
    ISuperAdminTelegramBotApi botApi,
    IOptions<SuperAdminTelegramNotificationOptions> options,
    ILogger<SuperAdminTelegramWebhookRegistrationHostedService> logger)
  {
    _botApi = botApi;
    _options = options.Value;
    _logger = logger;
  }

  public async Task StartAsync(CancellationToken cancellationToken)
  {
    if (!_options.AutoRegisterWebhookOnStart)
    {
      _logger.LogInformation("SuperAdmin Telegram webhook auto-registration disabled.");
      return;
    }

    if (string.IsNullOrWhiteSpace(_options.BotToken) ||
        string.IsNullOrWhiteSpace(_options.WebhookSecretToken) ||
        string.IsNullOrWhiteSpace(_options.PublicBaseUrl))
    {
      _logger.LogWarning(
        "SuperAdmin Telegram webhook auto-registration skipped: BotToken/WebhookSecretToken/PublicBaseUrl is not fully configured.");
      return;
    }

    var baseUrl = _options.PublicBaseUrl.Trim().TrimEnd('/');
    var webhookUrl = $"{baseUrl}/api/telegram/superadmin-bot/webhook";

    try
    {
      await _botApi.SetWebhookAsync(webhookUrl, _options.WebhookSecretToken, cancellationToken);
      _logger.LogInformation("SuperAdmin Telegram webhook registered: {WebhookUrl}", webhookUrl);
    }
    catch (Exception exception)
    {
      _logger.LogError(exception, "SuperAdmin Telegram webhook registration failed for {WebhookUrl}", webhookUrl);
    }
  }

  public Task StopAsync(CancellationToken cancellationToken) => Task.CompletedTask;
}
