using Yalla.Application.DTO.Response;

namespace Yalla.Application.Services;

public interface IPendingRefundService
{
  /// <summary>Returns every refund row that hasn't yet been
  /// processed, oldest first — that's the SuperAdmin to-do list.</summary>
  Task<IReadOnlyList<PendingRefundResponse>> GetPendingAsync(
    CancellationToken cancellationToken = default);

  /// <summary>Marks the row as physically settled. Captures the
  /// SuperAdmin id + bank-reference comment. Idempotent guard: the
  /// domain throws if the row was already processed, so concurrent
  /// admin actions can't double-mark.</summary>
  Task<PendingRefundResponse> MarkProcessedAsync(
    Guid refundId,
    Guid superAdminId,
    string? comment,
    CancellationToken cancellationToken = default);
}
