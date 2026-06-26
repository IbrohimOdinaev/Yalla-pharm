using Yalla.Domain.Enums;

namespace Yalla.Application.DTO.Response;

public sealed class PharmacyWorkerResponse
{
  public Guid Id { get; init; }
  public string Name { get; init; } = string.Empty;
  public string PhoneNumber { get; init; } = string.Empty;
  public string? AvatarUrl { get; init; }
  public Guid PharmacyId { get; init; }
  public Role Role { get; init; }
}
