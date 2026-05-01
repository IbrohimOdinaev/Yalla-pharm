using Yalla.Domain.Enums;

namespace Yalla.Application.DTO.Response;

public sealed class RefundRequestResponse
{
  public Guid RefundRequestId { get; init; }
  public Guid? OrderId { get; init; }
  public Guid ClientId { get; init; }
  public Guid PharmacyId { get; init; }
  public string? PaymentTransactionId { get; init; }
  public decimal Amount { get; init; }
  public string Currency { get; init; } = string.Empty;
  public string Reason { get; init; } = string.Empty;
  /// <summary>
  /// Stringified <see cref="RefundRequestStatus"/> ("Created" | "InitiatedBySuperAdmin" | "Completed" | "Rejected").
  /// Stringified at the projection layer so the frontend can filter by name without
  /// depending on numeric enum values; <c>System.Text.Json</c> defaults to int otherwise.
  /// </summary>
  public string Status { get; init; } = string.Empty;
  public RefundType Type { get; init; }
  public DateTime CreatedAtUtc { get; init; }
  public DateTime UpdatedAtUtc { get; init; }

  // Order context — denormalised for the SuperAdmin listing so the UI doesn't need a second roundtrip per row.
  public string? OrderStatus { get; init; }
  public decimal? OrderCost { get; init; }
  public string? PharmacyTitle { get; init; }
  public string? ClientName { get; init; }
  public string? ClientPhoneNumber { get; init; }

  public IReadOnlyCollection<RefundRequestPositionResponse> Positions { get; init; } = [];
}
