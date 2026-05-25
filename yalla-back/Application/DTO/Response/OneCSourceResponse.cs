namespace Yalla.Application.DTO.Response;

public sealed record OneCSourceResponse(
  Guid Id,
  Guid PharmacyId,
  string PharmacyTitle,
  string Token,
  string Name,
  bool IsActive,
  string EndpointPath,
  DateTime CreatedAtUtc,
  OneCExchangeStatusResponse ExchangeStatus);
