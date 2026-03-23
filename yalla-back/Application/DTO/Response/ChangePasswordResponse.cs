namespace Yalla.Application.DTO.Response;

public sealed class ChangePasswordResponse
{
  public Guid UserId { get; init; }
  public bool IsChanged { get; init; }
}
