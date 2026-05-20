using Yalla.Domain.Exceptions;

namespace Yalla.Domain.Entities;

public class OneCImportRun
{
  public Guid Id { get; private set; }
  public Guid SourceId { get; private set; }
  public string FileKind { get; private set; } = string.Empty;
  public string FileName { get; private set; } = string.Empty;
  public long FileSize { get; private set; }
  public string FileSignature { get; private set; } = string.Empty;
  public string Status { get; private set; } = "started";
  public int ProcessedCount { get; private set; }
  public int LinkedCount { get; private set; }
  public int UpdatedCount { get; private set; }
  public int UnmatchedCount { get; private set; }
  public string? Error { get; private set; }
  public DateTime StartedAtUtc { get; private set; }
  public DateTime? FinishedAtUtc { get; private set; }

  private OneCImportRun() { }

  public OneCImportRun(Guid sourceId, string fileKind, string fileName, long fileSize, string fileSignature, DateTime startedAtUtc)
  {
    if (sourceId == Guid.Empty)
      throw new DomainArgumentException("OneCImportRun.SourceId can't be empty.");

    if (string.IsNullOrWhiteSpace(fileKind))
      throw new DomainArgumentException("OneCImportRun.FileKind can't be null or whitespace.");

    if (string.IsNullOrWhiteSpace(fileName))
      throw new DomainArgumentException("OneCImportRun.FileName can't be null or whitespace.");

    Id = Guid.NewGuid();
    SourceId = sourceId;
    FileKind = fileKind.Trim().ToLowerInvariant();
    FileName = fileName.Trim();
    FileSize = fileSize;
    FileSignature = fileSignature;
    StartedAtUtc = startedAtUtc;
  }

  public void Complete(int processed, int linked, int updated, int unmatched, DateTime finishedAtUtc)
  {
    ProcessedCount = processed;
    LinkedCount = linked;
    UpdatedCount = updated;
    UnmatchedCount = unmatched;
    Status = "success";
    FinishedAtUtc = finishedAtUtc;
    Error = null;
  }

  public void Fail(string error, DateTime finishedAtUtc)
  {
    Status = "failed";
    Error = string.IsNullOrWhiteSpace(error) ? "Unknown error" : error.Trim();
    FinishedAtUtc = finishedAtUtc;
  }
}
