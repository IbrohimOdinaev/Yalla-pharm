namespace Yalla.Application.DTO.Response;

public sealed record OneCSyncLogsResponse(
  IReadOnlyList<OneCSourceSyncStatusResponse> Sources,
  IReadOnlyList<OneCImportRunLogResponse> NomenclatureXml,
  IReadOnlyList<OneCImportRunLogResponse> OffersXml);
