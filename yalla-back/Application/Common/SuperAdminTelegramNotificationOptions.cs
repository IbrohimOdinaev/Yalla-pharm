namespace Yalla.Application.Common;

public sealed class SuperAdminTelegramNotificationOptions
{
  public const string SectionName = "TelegramSuperAdminNotifications";

  public bool Enabled { get; set; } = true;
  public string BotToken { get; set; } = string.Empty;
  public string BotUsername { get; set; } = "yallapharm_superadmin_notify_bot";
  public string PublicBaseUrl { get; set; } = string.Empty;
  public string WebhookSecretToken { get; set; } = string.Empty;
  public bool AutoRegisterWebhookOnStart { get; set; }
  public int BatchSize { get; set; } = 50;
  public int PollIntervalSeconds { get; set; } = 15;
  public int MaxAttempts { get; set; } = 5;
  public int RetryBackoffSeconds { get; set; } = 30;
  public int RetentionDays { get; set; } = 7;
  public int CatchUpMaxOrderAgeHours { get; set; } = 48;
  public int CatchUpMaxPrescriptionAgeHours { get; set; } = 48;
}
