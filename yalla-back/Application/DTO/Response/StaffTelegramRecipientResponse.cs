namespace Yalla.Application.DTO.Response;

public sealed class StaffTelegramRecipientResponse
{
  public Guid Id { get; init; }
  public long TelegramUserId { get; init; }
  public string? TelegramUsername { get; init; }
  public string? TelegramFirstName { get; init; }
  public string? TelegramLastName { get; init; }
  public bool IsActive { get; init; }
  public DateTime CreatedAtUtc { get; init; }
}
