namespace Yalla.Application.DTO.Response;

public sealed class MedicineImageResponse
{
  public Guid Id { get; init; }
  public string Key { get; init; } = string.Empty;
  public bool IsMain { get; init; }
  public bool IsMinimal { get; init; }
}
