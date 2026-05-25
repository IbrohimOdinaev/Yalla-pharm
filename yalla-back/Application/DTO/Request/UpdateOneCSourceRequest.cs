namespace Yalla.Application.DTO.Request;

public sealed class UpdateOneCSourceRequest
{
  public string Name { get; init; } = string.Empty;
  public bool IsActive { get; init; } = true;
}
