namespace Yalla.Application.Abstractions;

public sealed class MedicineImageContent
{
  public required Stream Content { get; init; }
  public string ContentType { get; init; } = "application/octet-stream";
}
