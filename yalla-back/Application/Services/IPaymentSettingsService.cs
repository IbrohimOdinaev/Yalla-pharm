namespace Yalla.Application.Services;

public interface IPaymentSettingsService
{
  /// <summary>Returns the current Dushanbe City base URL, or null to fall back to config defaults.</summary>
  Task<string?> GetDcBaseUrlAsync(CancellationToken cancellationToken = default);

  /// <summary>SuperAdmin-only. Pass null/empty to reset to config default.</summary>
  Task SetDcBaseUrlAsync(string? url, Guid updatedByUserId, CancellationToken cancellationToken = default);

  Task<PaymentSettingsSnapshot> GetSnapshotAsync(CancellationToken cancellationToken = default);
}

public sealed class PaymentSettingsSnapshot
{
  public string? DcBaseUrl { get; init; }
  public string DcBaseUrlEffective { get; init; } = string.Empty;
  public DateTime UpdatedAtUtc { get; init; }
  public Guid? UpdatedByUserId { get; init; }
}
