namespace Yalla.Application.DTO.Request;

public sealed class RegisterAdminWithPharmacyRequest
{
  public string AdminName { get; init; } = string.Empty;
  public string AdminPhoneNumber { get; init; } = string.Empty;
  public string? AdminPassword { get; init; }
  public string PharmacyTitle { get; init; } = string.Empty;
  public string PharmacyAddress { get; init; } = string.Empty;
  public double? Latitude { get; init; }
  public double? Longitude { get; init; }
  public bool IsPharmacyActive { get; init; } = true;
  public bool HasDelivery { get; init; }
  public string? OpensAt { get; init; }
  public string? ClosesAt { get; init; }
}
