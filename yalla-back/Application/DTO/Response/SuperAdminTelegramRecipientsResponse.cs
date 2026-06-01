namespace Yalla.Application.DTO.Response;

public sealed class SuperAdminTelegramRecipientsResponse
{
  public IReadOnlyCollection<SuperAdminTelegramRecipientResponse> Recipients { get; init; } = [];
}
