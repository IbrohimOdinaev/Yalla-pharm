namespace Yalla.Application.Services;

public interface IPaymentSettingsService
{
  /// <summary>Returns the current Dushanbe City base URL, or null to fall back to config defaults.</summary>
  Task<string?> GetDcBaseUrlAsync(CancellationToken cancellationToken = default);

  /// <summary>SuperAdmin-only. Pass null/empty to reset to config default.</summary>
  Task SetDcBaseUrlAsync(string? url, Guid updatedByUserId, CancellationToken cancellationToken = default);

  Task SetAlifUrlTemplateAsync(string? urlTemplate, Guid updatedByUserId, CancellationToken cancellationToken = default);

  Task SetEskhataUrlTemplateAsync(string? urlTemplate, Guid updatedByUserId, CancellationToken cancellationToken = default);

  Task SetPaymentMethodEnabledAsync(string method, bool isEnabled, Guid updatedByUserId, CancellationToken cancellationToken = default);

  Task SetStaffCompensationRatesAsync(
    decimal pharmacyOrderReadyFeeAmount,
    decimal prescriptionDecodedFeeAmount,
    Guid updatedByUserId,
    CancellationToken cancellationToken = default);

  Task<PaymentSettingsSnapshot> GetSnapshotAsync(CancellationToken cancellationToken = default);
}

public sealed class PaymentSettingsSnapshot
{
  public string? DcBaseUrl { get; init; }
  public string DcBaseUrlEffective { get; init; } = string.Empty;
  public string? AlifUrlTemplate { get; init; }
  public string AlifUrlTemplateEffective { get; init; } = string.Empty;
  public string? EskhataUrlTemplate { get; init; }
  public string EskhataUrlTemplateEffective { get; init; } = string.Empty;
  public bool IsDcEnabled { get; init; } = true;
  public bool IsAlifEnabled { get; init; } = true;
  public bool IsEskhataEnabled { get; init; } = true;
  public decimal PharmacyOrderReadyFeeAmount { get; init; }
  public decimal PrescriptionDecodedFeeAmount { get; init; }
  public DateTime UpdatedAtUtc { get; init; }
  public Guid? UpdatedByUserId { get; init; }
}
