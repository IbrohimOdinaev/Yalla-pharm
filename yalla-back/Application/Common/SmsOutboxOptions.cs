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

  /// <summary>
  /// Maximum age of an order (since <c>OrderPlacedAt</c>) for which the
  /// catch-up enqueue worker will still create a status SMS. Anything older
  /// is treated as "too late, the client moved on" and silently skipped —
  /// prevents the worker from blasting a backlog of historical orders the
  /// first time it runs after a redeploy / migration / phone-number change.
  /// 48h covers the realistic same-day-or-next-day order lifecycle and
  /// leaves room for delayed manual confirmations.
  /// </summary>
  public int CatchUpMaxOrderAgeHours { get; set; } = 48;
}
