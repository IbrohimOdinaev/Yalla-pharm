namespace Yalla.Application.Common;

public sealed class TelegramOutboxOptions
{
  public const string SectionName = "TelegramOutbox";

  public bool Enabled { get; set; } = true;
  public int BatchSize { get; set; } = 50;
  public int PollIntervalSeconds { get; set; } = 15;
  public int MaxAttempts { get; set; } = 5;
  public int RetryBackoffSeconds { get; set; } = 30;
  public int RetentionDays { get; set; } = 7;

  /// <summary>
  /// Mirror of <c>SmsOutboxOptions.CatchUpMaxOrderAgeHours</c> — the
  /// Telegram catch-up worker uses the same logic and would otherwise
  /// blast historical orders the moment a client links their TG to an
  /// existing account.
  /// </summary>
  public int CatchUpMaxOrderAgeHours { get; set; } = 48;
}
