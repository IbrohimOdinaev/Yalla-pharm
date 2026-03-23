namespace Yalla.Domain.Enums;

public enum PaymentIntentState
{
  Created = 0,
  AwaitingAdminConfirmation = 1,
  Confirmed = 2,
  Rejected = 3,
  NeedsResolution = 4
}
