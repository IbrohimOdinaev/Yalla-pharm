namespace Yalla.Application.DTO.Request;

public sealed class CalculateDeliveryRequest
{
  public Guid PharmacyId { get; init; }
  public long? ToAddressId { get; init; }
  public string ToTitle { get; init; } = string.Empty;
  public string ToAddress { get; init; } = string.Empty;
  public double ToLatitude { get; init; }
  public double ToLongitude { get; init; }
}
