namespace Yalla.Application.Common;

public sealed class SmsOutboxOptions
{
  public const string SectionName = "SmsOutbox";

  public bool Enabled { get; set; } = true;
  public int BatchSize { get; set; } = 50;
  public int PollIntervalSeconds { get; set; } = 15;
  public int MaxAttempts { get; set; } = 5;
  public int RetryBackoffSeconds { get; set; } = 30;
  public int RetentionDays { get; set; } = 7;
}
