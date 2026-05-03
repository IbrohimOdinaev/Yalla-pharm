namespace Yalla.Application.Abstractions;

/// <summary>
/// Storage abstraction for prescription photos. Mirrors the medicine-image
/// storage contract but lives behind its own MinIO key prefix
/// (`prescriptions/yyyy/MM/dd/{guid}{ext}`) so prescription assets and
/// product imagery never share namespaces.
/// </summary>
public interface IPrescriptionImageStorage
{
    Task<PrescriptionImageContent> GetContentAsync(
      string key,
      CancellationToken cancellationToken = default);

    Task<string> UploadAsync(
      Stream content,
      string contentType,
      string fileName,
      CancellationToken cancellationToken = default);

    Task<string> GetUrlAsync(
      string key,
      CancellationToken cancellationToken = default);

    Task DeleteAsync(
      string key,
      CancellationToken cancellationToken = default);
}

public sealed class PrescriptionImageContent
{
    public required Stream Content { get; init; }
    public string ContentType { get; init; } = "application/octet-stream";
}
