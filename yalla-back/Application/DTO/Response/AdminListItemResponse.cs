namespace Yalla.Application.DTO.Response;

public sealed class AdminListItemResponse
{
  public Guid AdminId { get; init; }
  public string Name { get; init; } = string.Empty;
  public string PhoneNumber { get; init; } = string.Empty;
  public Guid PharmacyId { get; init; }
  public string PharmacyTitle { get; init; } = string.Empty;
  public bool PharmacyIsActive { get; init; }
}
