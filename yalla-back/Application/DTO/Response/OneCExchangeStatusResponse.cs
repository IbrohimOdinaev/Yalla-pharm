namespace Yalla.Application.DTO.Response;

public sealed record OneCExchangeStatusResponse(
  DateTime? LastContactAtUtc,
  string? LastMode,
  DateTime? LastCheckAuthAtUtc,
  DateTime? LastInitAtUtc,
  DateTime? LastFileAtUtc,
  string? LastFilename,
  long? LastFileSize);
