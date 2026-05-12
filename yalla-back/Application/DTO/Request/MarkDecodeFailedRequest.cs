using Yalla.Domain.Enums;

namespace Yalla.Application.DTO.Request;

public sealed class MarkDecodeFailedRequest
{
  /// <summary>Why the pharmacist couldn't decode. Required —
  /// determines downstream effects (free credit vs. pending refund).</summary>
  public PrescriptionDecodeFailureReason Reason { get; init; }

  /// <summary>Optional free-text comment shown to the client.
  /// Capped at 500 chars; longer values are truncated.</summary>
  public string? Comment { get; init; }
}
