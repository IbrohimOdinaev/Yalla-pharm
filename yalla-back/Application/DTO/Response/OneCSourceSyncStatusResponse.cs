namespace Yalla.Application.DTO.Response;

public sealed record OneCSourceSyncStatusResponse(
  Guid SourceId,
  Guid PharmacyId,
  string SourceToken,
  string SourceName,
  string PharmacyTitle,
  bool IsActive,
  string EndpointPath,
  OneCExchangeStatusResponse ExchangeStatus,
  int TotalLinks,
  int CatalogLinkedMedicines,
  int AutoMatchedLinks,
  int ConfirmedLinks,
  int ManualRequiredLinks,
  int MissingBarcodeLinks,
  int BarcodeConflictLinks,
  OneCImportRunLogResponse? LatestImport,
  OneCImportRunLogResponse? LatestOffers);
