namespace Yalla.Domain.Enums;

public enum SmsOutboxState
{
  Pending = 0,
  Sent = 1,
  Failed = 2,
  Processing = 3
}
