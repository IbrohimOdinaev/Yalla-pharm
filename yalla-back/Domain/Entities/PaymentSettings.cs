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
}
