using Yalla.Application.DTO.Response;

namespace Yalla.Application.Abstractions;

public interface IJuraService
{
  Task<List<JuraAddressSuggestion>> SearchAddressAsync(string text, CancellationToken ct);

  Task<JuraCalculateResult> CalculateDeliveryAsync(
    JuraAddress from, JuraAddress to, int? tariffId, string? clientPhone, CancellationToken ct);

  Task<JuraCreateOrderResult> CreateDeliveryOrderAsync(
    JuraAddress from, JuraAddress to, int? tariffId, string? clientPhone, CancellationToken ct);

  Task<JuraOrderStatusResult> GetOrderStatusAsync(long juraOrderId, CancellationToken ct);

  Task<JuraDriverPositionResult> GetDriverPositionAsync(long deviceId, CancellationToken ct);

  Task CancelOrderAsync(long juraOrderId, string reason, CancellationToken ct);

  Task<List<JuraTariff>> GetTariffsAsync(CancellationToken ct);
}

public sealed class JuraAddress
{
  public long? Id { get; init; }
  public string Address { get; init; } = string.Empty;
  public string Title { get; init; } = string.Empty;
  public double Lat { get; init; }
  public double Lng { get; init; }
}

public sealed class JuraCalculateResult
{
  public decimal Amount { get; init; }
  public double Distance { get; init; }
}

public sealed class JuraCreateOrderResult
{
  public long OrderId { get; init; }
  public int StatusId { get; init; }
  public string Status { get; init; } = string.Empty;
  public string? RecipientCode { get; init; }
  public long? PerformerDeviceId { get; init; }
  public string? PerformerFirstName { get; init; }
  public string? PerformerLastName { get; init; }
  public string? PerformerPhone { get; init; }
}

public sealed class JuraOrderStatusResult
{
  public long OrderId { get; init; }
  public int StatusId { get; init; }
  public string Status { get; init; } = string.Empty;
  public long? PerformerId { get; init; }
  public long? TraccarDeviceId { get; init; }
  public string? FirstName { get; init; }
  public string? LastName { get; init; }
  public string? Phone { get; init; }
}

public sealed class JuraDriverPositionResult
{
  public long DeviceId { get; init; }
  public double Lat { get; init; }
  public double Lng { get; init; }
}

public sealed class JuraTariff
{
  public int Id { get; init; }
  public string Name { get; init; } = string.Empty;
  public int DivisionId { get; init; }
}
