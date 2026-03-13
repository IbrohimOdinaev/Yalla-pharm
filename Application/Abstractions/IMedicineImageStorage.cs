namespace Yalla.Application.Abstractions;

public interface IMedicineImageStorage
{
  Task<MedicineImageContent> GetContentAsync(
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
