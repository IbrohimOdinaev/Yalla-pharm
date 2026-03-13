using Yalla.Domain.Enums;

namespace Yalla.Application.DTO.Response;

public sealed class UserListItemResponse
{
  public Guid UserId { get; init; }
  public string Name { get; init; } = string.Empty;
  public string PhoneNumber { get; init; } = string.Empty;
  public Role Role { get; init; }
  public Guid? PharmacyId { get; init; }
  public string PharmacyTitle { get; init; } = string.Empty;
  public bool? PharmacyIsActive { get; init; }
  public int OrdersCount { get; init; }
  public IReadOnlyCollection<UserOrderListItemResponse> Orders { get; init; } = [];
}
