using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Yalla.Application.Abstractions;
using Yalla.Application.Common;

namespace Yalla.Infrastructure.Telegram;

public sealed class StaffTelegramWebhookRegistrationHostedService : IHostedService
{
  private readonly IStaffTelegramBotApi _botApi;
  private readonly StaffTelegramNotificationOptions _options;
  private readonly ILogger<StaffTelegramWebhookRegistrationHostedService> _logger;

  public StaffTelegramWebhookRegistrationHostedService(
    IStaffTelegramBotApi botApi,
    IOptions<StaffTelegramNotificationOptions> options,
    ILogger<StaffTelegramWebhookRegistrationHostedService> logger)
  {
    _botApi = botApi;
    _options = options.Value;
    _logger = logger;
  }

  public async Task StartAsync(CancellationToken cancellationToken)
  {
    if (!_options.AutoRegisterWebhookOnStart)
    {
      _logger.LogInformation("Staff Telegram webhook auto-registration disabled.");
      return;
    }

    if (string.IsNullOrWhiteSpace(_options.BotToken) ||
        string.IsNullOrWhiteSpace(_options.WebhookSecretToken) ||
        string.IsNullOrWhiteSpace(_options.PublicBaseUrl))
    {
      _logger.LogWarning(
        "Staff Telegram webhook auto-registration skipped: BotToken/WebhookSecretToken/PublicBaseUrl is not fully configured.");
      return;
    }

    var baseUrl = _options.PublicBaseUrl.Trim().TrimEnd('/');
    var webhookUrl = $"{baseUrl}/api/telegram/staff-bot/webhook";

    try
    {
      await _botApi.SetWebhookAsync(webhookUrl, _options.WebhookSecretToken, cancellationToken);
      _logger.LogInformation("Staff Telegram webhook registered: {WebhookUrl}", webhookUrl);
    }
    catch (Exception exception)
    {
      _logger.LogError(exception, "Staff Telegram webhook registration failed for {WebhookUrl}", webhookUrl);
    }
  }

  public Task StopAsync(CancellationToken cancellationToken) => Task.CompletedTask;
}
