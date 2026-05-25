namespace Yalla.Application.DTO.Request;

public sealed class CreateOneCSourceRequest
{
  public Guid PharmacyId { get; init; }
  public string Token { get; init; } = string.Empty;
  public string Name { get; init; } = string.Empty;
}
