namespace Yalla.Application.DTO.Response;

public sealed class StaffTelegramRecipientsResponse
{
  public IReadOnlyCollection<StaffTelegramRecipientResponse> Recipients { get; init; } = [];
}
