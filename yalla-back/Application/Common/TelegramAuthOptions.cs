namespace Yalla.Application.Common;

public sealed class TelegramAuthOptions
{
  public const string SectionName = "Telegram";

  /// <summary>Bot HTTP token from BotFather (must be moved to user-secrets in production).</summary>
  public string BotToken { get; set; } = string.Empty;

  /// <summary>Bot username without @, used to build deeplink (e.g. "yallapharm_bot").</summary>
  public string BotUsername { get; set; } = string.Empty;

  /// <summary>Public HTTPS base URL of the API for the Telegram webhook target. Example: "https://api.yallafarm.tj"</summary>
  public string WebhookPublicBaseUrl { get; set; } = string.Empty;

  /// <summary>
  /// Shared secret sent by Telegram in <c>X-Telegram-Bot-Api-Secret-Token</c> header.
  /// Generate once with <c>openssl rand -hex 32</c>.
  /// </summary>
  public string WebhookSecretToken { get; set; } = string.Empty;

  /// <summary>How long an auth session is valid before it must be confirmed (default 5 minutes).</summary>
  public int AuthSessionTtlSeconds { get; set; } = 300;

  /// <summary>If true, the API tries to register the webhook with Telegram on startup. Useful for dev/staging.</summary>
  public bool AutoRegisterWebhookOnStart { get; set; }
}
