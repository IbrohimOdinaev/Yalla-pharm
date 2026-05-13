namespace Yalla.Application.DTO.Response;

/// <summary>
/// Result of a deactivate/activate call. <see cref="Warning"/> is
/// surfaced when there's open work tied to the account (e.g. orders
/// in Preparing for a worker, prescriptions in InReview for a
/// pharmacist) — the operation still goes through, but the caller
/// is expected to handle re-assignment manually.
/// </summary>
public sealed class DeactivateUserResponse
{
  public Guid UserId { get; init; }
  public bool IsActive { get; init; }
  public string? Warning { get; init; }
  public int OpenWorkItemsCount { get; init; }
}
