namespace Yalla.Application.Common;

public sealed class StaffTelegramNotificationOptions
{
  public const string SectionName = "TelegramStaffNotifications";

  public bool Enabled { get; set; } = true;
  public string BotToken { get; set; } = string.Empty;
  public string PublicBaseUrl { get; set; } = string.Empty;
  public int BatchSize { get; set; } = 50;
  public int PollIntervalSeconds { get; set; } = 15;
  public int MaxAttempts { get; set; } = 5;
  public int RetryBackoffSeconds { get; set; } = 30;
  public int RetentionDays { get; set; } = 7;
  public int CatchUpMaxOrderAgeHours { get; set; } = 48;
  public int CatchUpMaxLookupAgeHours { get; set; } = 48;
}
