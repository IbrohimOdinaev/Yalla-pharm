using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Yalla.Application.Abstractions;
using Yalla.Application.Common;

namespace Yalla.Infrastructure.Telegram;

public sealed class TelegramWebhookRegistrationHostedService : IHostedService
{
  private readonly ITelegramBotApi _botApi;
  private readonly TelegramAuthOptions _options;
  private readonly ILogger<TelegramWebhookRegistrationHostedService> _logger;

  public TelegramWebhookRegistrationHostedService(
    ITelegramBotApi botApi,
    IOptions<TelegramAuthOptions> options,
    ILogger<TelegramWebhookRegistrationHostedService> logger)
  {
    _botApi = botApi;
    _options = options.Value;
    _logger = logger;
  }

  public async Task StartAsync(CancellationToken cancellationToken)
  {
    if (!_options.AutoRegisterWebhookOnStart)
    {
      _logger.LogInformation("Telegram webhook auto-registration disabled.");
      return;
    }

    if (string.IsNullOrWhiteSpace(_options.BotToken) ||
        string.IsNullOrWhiteSpace(_options.WebhookSecretToken) ||
        string.IsNullOrWhiteSpace(_options.WebhookPublicBaseUrl))
    {
      _logger.LogWarning(
        "Telegram webhook auto-registration skipped: BotToken/WebhookSecretToken/WebhookPublicBaseUrl is not fully configured.");
      return;
    }

    var baseUrl = _options.WebhookPublicBaseUrl.Trim().TrimEnd('/');
    var webhookUrl = $"{baseUrl}/api/telegram/bot/webhook";

    try
    {
      await _botApi.SetWebhookAsync(webhookUrl, _options.WebhookSecretToken, cancellationToken);
      _logger.LogInformation("Telegram webhook registered: {WebhookUrl}", webhookUrl);
    }
    catch (Exception ex)
    {
      _logger.LogError(ex, "Telegram webhook registration failed for {WebhookUrl}", webhookUrl);
    }
  }

  public Task StopAsync(CancellationToken cancellationToken) => Task.CompletedTask;
}
