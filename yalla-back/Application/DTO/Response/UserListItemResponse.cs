using Yalla.Domain.Enums;

namespace Yalla.Application.DTO.Response;

public sealed class UserListItemResponse
{
  public Guid UserId { get; init; }
  public string Name { get; init; } = string.Empty;
  public string PhoneNumber { get; init; } = string.Empty;
  public Role Role { get; init; }
  public bool IsActive { get; init; }
  public string AuthType { get; init; } = string.Empty;
  public bool HasPasswordLogin { get; init; }
  public string? AvatarUrl { get; init; }
  public Gender? Gender { get; init; }
  public string? DateOfBirth { get; init; }
  public long? TelegramId { get; init; }
  public string? TelegramUsername { get; init; }
  public DateTime? DeactivatedAtUtc { get; init; }
  public Guid? DeactivatedByUserId { get; init; }
  public string? DeactivationReason { get; init; }
  public Guid? PharmacyId { get; init; }
  public string PharmacyTitle { get; init; } = string.Empty;
  public bool? PharmacyIsActive { get; init; }
  public int OrdersCount { get; init; }
  public IReadOnlyCollection<UserOrderListItemResponse> Orders { get; init; } = [];
}
