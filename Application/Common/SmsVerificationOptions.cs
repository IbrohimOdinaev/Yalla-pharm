namespace Yalla.Application.Common;

public sealed class SmsVerificationOptions
{
  public const string SectionName = "SmsVerification";

  public bool RegistrationEnabled { get; set; } = true;
  public bool AllowRegistrationBypass { get; set; }
  public int CodeLength { get; set; } = 6;
  public int CodeTtlMinutes { get; set; } = 10;
  public int ResendCooldownSeconds { get; set; } = 60;
  public int MaxVerificationAttempts { get; set; } = 5;
  public int MaxResendCount { get; set; } = 5;
  public int RequestRateLimitPerMinute { get; set; } = 10;
  public int VerifyRateLimitPerMinute { get; set; } = 30;
  public int ResendRateLimitPerMinute { get; set; } = 10;
  public int CleanupIntervalMinutes { get; set; } = 15;
  public int ExpiredSessionRetentionMinutes { get; set; } = 120;
  public int CompletedSessionRetentionHours { get; set; } = 24;
  public string MessageTemplate { get; set; } = "Код подтверждения Yalla Farm: {code}";
  public string FixedCodeForTests { get; set; } = "111111";
}
