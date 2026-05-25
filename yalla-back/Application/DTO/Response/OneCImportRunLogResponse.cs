namespace Yalla.Application.DTO.Response;

public sealed record OneCImportRunLogResponse(
  Guid Id,
  Guid SourceId,
  Guid PharmacyId,
  string SourceToken,
  string SourceName,
  string PharmacyTitle,
  string FileKind,
  string FileName,
  long FileSize,
  string Status,
  int ProcessedCount,
  int LinkedCount,
  int UpdatedCount,
  int InsertedCount,
  int UnchangedCount,
  int UnmatchedCount,
  string? Error,
  DateTime StartedAtUtc,
  DateTime? FinishedAtUtc);
