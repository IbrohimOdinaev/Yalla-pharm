using Yalla.Domain.Exceptions;

namespace Yalla.Domain.Entities;

/// <summary>
/// Singleton settings row that can be edited by SuperAdmin without redeploying.
/// Falls back to compile-time defaults in <c>DushanbeCityPaymentOptions</c> when
/// values are null/empty.
/// </summary>
public class PaymentSettings
{
  /// <summary>Fixed singleton id — the whole table always has exactly one row.</summary>
  public static readonly Guid SingletonId = new("00000000-0000-0000-0000-000000000001");

  public Guid Id { get; private set; }

  public string? DcBaseUrl { get; private set; }

  public string? AlifUrlTemplate { get; private set; }

  public string? EskhataUrlTemplate { get; private set; }

  public bool IsDcEnabled { get; private set; } = true;

  public bool IsAlifEnabled { get; private set; } = true;

  public bool IsEskhataEnabled { get; private set; } = true;

  public DateTime UpdatedAtUtc { get; private set; }

  public Guid? UpdatedByUserId { get; private set; }

  private PaymentSettings() { }

  public PaymentSettings(Guid id)
  {
    if (id == Guid.Empty)
      throw new DomainArgumentException("PaymentSettings.Id can't be empty.");
    Id = id;
    UpdatedAtUtc = DateTime.UtcNow;
  }

  public void SetDcBaseUrl(string? url, Guid? updatedBy)
  {
    if (!string.IsNullOrWhiteSpace(url))
    {
      if (!Uri.TryCreate(url.Trim(), UriKind.Absolute, out _))
        throw new DomainArgumentException("DcBaseUrl must be a valid absolute URL.");
      DcBaseUrl = url.Trim();
    }
    else
    {
      DcBaseUrl = null;
    }
    UpdatedAtUtc = DateTime.UtcNow;
    UpdatedByUserId = updatedBy;
  }

  public void SetAlifUrlTemplate(string? urlTemplate, Guid? updatedBy)
  {
    AlifUrlTemplate = NormalizePaymentTemplate(urlTemplate, nameof(AlifUrlTemplate));
    UpdatedAtUtc = DateTime.UtcNow;
    UpdatedByUserId = updatedBy;
  }

  public void SetEskhataUrlTemplate(string? urlTemplate, Guid? updatedBy)
  {
    EskhataUrlTemplate = NormalizePaymentTemplate(urlTemplate, nameof(EskhataUrlTemplate));
    UpdatedAtUtc = DateTime.UtcNow;
    UpdatedByUserId = updatedBy;
  }

  public void SetPaymentMethodEnabled(string method, bool isEnabled, Guid? updatedBy)
  {
    var normalized = (method ?? string.Empty).Trim().ToLowerInvariant();
    switch (normalized)
    {
      case "dc":
      case "dushanbecity":
      case "dushanbe-city":
        IsDcEnabled = isEnabled;
        break;
      case "alif":
        IsAlifEnabled = isEnabled;
        break;
      case "eskhata":
      case "эcхата":
      case "эсхата":
        IsEskhataEnabled = isEnabled;
        break;
      default:
        throw new DomainArgumentException("Unknown payment method.");
    }

    UpdatedAtUtc = DateTime.UtcNow;
    UpdatedByUserId = updatedBy;
  }

  private static string? NormalizePaymentTemplate(string? urlTemplate, string fieldName)
  {
    if (string.IsNullOrWhiteSpace(urlTemplate))
      return null;

    var trimmed = urlTemplate.Trim();
    if (trimmed.Length > 2048)
      throw new DomainArgumentException($"{fieldName} can't be longer than 2048 characters.");

    var normalizedForValidation = trimmed.Replace("{amount}", "1.00", StringComparison.OrdinalIgnoreCase);
    if (!Uri.TryCreate(normalizedForValidation, UriKind.Absolute, out var uri)
        || string.IsNullOrWhiteSpace(uri.Scheme))
      throw new DomainArgumentException($"{fieldName} must be a valid absolute URL template.");

    return trimmed;
  }
}
