namespace Yalla.Application.Abstractions;

/// <summary>
/// Storage abstraction for the optional photos pharmacy admins attach to
/// their <c>ManualItemLookupResponse</c>. Lives behind its own MinIO key
/// prefix (`manual-lookups/yyyy/MM/dd/{guid}{ext}`) so out-of-catalog
/// lookup imagery never collides with product imagery or prescription
/// scans for retention/access-policy purposes.
/// </summary>
public interface IManualLookupImageStorage
{
    Task<ManualLookupImageContent> GetContentAsync(
      string key,
      CancellationToken cancellationToken = default);

    Task<string> UploadAsync(
      Stream content,
      string contentType,
      string fileName,
      CancellationToken cancellationToken = default);

    Task DeleteAsync(
      string key,
      CancellationToken cancellationToken = default);
}

public sealed class ManualLookupImageContent
{
    public required Stream Content { get; init; }
    public string ContentType { get; init; } = "application/octet-stream";
}
