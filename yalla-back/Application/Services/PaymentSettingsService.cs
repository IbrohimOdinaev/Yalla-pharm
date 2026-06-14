using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using Yalla.Application.Abstractions;
using Yalla.Application.Common;
using Yalla.Domain.Entities;

namespace Yalla.Application.Services;

public sealed class PaymentSettingsService : IPaymentSettingsService
{
  private const string LegacyAlifDeepLinkPrefix = "alifmobi:///toMobi?";
  private const string LegacyAlifHostDeepLinkPrefix = "alifmobi://toMobi?";
  private const string AlifDynamicLinkPrefix = "https://alifmobi.page.link/toMobi?";

  private readonly IAppDbContext _dbContext;
  private readonly DushanbeCityPaymentOptions _options;

  public PaymentSettingsService(IAppDbContext dbContext, IOptions<DushanbeCityPaymentOptions> options)
  {
    _dbContext = dbContext;
    _options = options.Value;
  }

  public async Task<string?> GetDcBaseUrlAsync(CancellationToken cancellationToken = default)
  {
    var entity = await _dbContext.PaymentSettings
      .AsNoTracking()
      .FirstOrDefaultAsync(x => x.Id == PaymentSettings.SingletonId, cancellationToken);
    return entity?.DcBaseUrl;
  }

  public async Task SetDcBaseUrlAsync(string? url, Guid updatedByUserId, CancellationToken cancellationToken = default)
  {
    var entity = await _dbContext.PaymentSettings
      .AsTracking()
      .FirstOrDefaultAsync(x => x.Id == PaymentSettings.SingletonId, cancellationToken);

    if (entity is null)
    {
      entity = new PaymentSettings(PaymentSettings.SingletonId);
      _dbContext.PaymentSettings.Add(entity);
    }

    entity.SetDcBaseUrl(url, updatedByUserId);
    await _dbContext.SaveChangesAsync(cancellationToken);
  }

  public async Task SetAlifUrlTemplateAsync(string? urlTemplate, Guid updatedByUserId, CancellationToken cancellationToken = default)
  {
    var entity = await GetOrCreateSettingsAsync(cancellationToken);
    entity.SetAlifUrlTemplate(urlTemplate, updatedByUserId);
    await _dbContext.SaveChangesAsync(cancellationToken);
  }

  public async Task SetEskhataUrlTemplateAsync(string? urlTemplate, Guid updatedByUserId, CancellationToken cancellationToken = default)
  {
    var entity = await GetOrCreateSettingsAsync(cancellationToken);
    entity.SetEskhataUrlTemplate(urlTemplate, updatedByUserId);
    await _dbContext.SaveChangesAsync(cancellationToken);
  }

  public async Task SetPaymentMethodEnabledAsync(string method, bool isEnabled, Guid updatedByUserId, CancellationToken cancellationToken = default)
  {
    var entity = await GetOrCreateSettingsAsync(cancellationToken);
    entity.SetPaymentMethodEnabled(method, isEnabled, updatedByUserId);
    await _dbContext.SaveChangesAsync(cancellationToken);
  }

  public async Task SetStaffCompensationRatesAsync(
    decimal pharmacyOrderReadyFeeAmount,
    decimal prescriptionDecodedFeeAmount,
    Guid updatedByUserId,
    CancellationToken cancellationToken = default)
  {
    var entity = await GetOrCreateSettingsAsync(cancellationToken);
    entity.SetStaffCompensationRates(pharmacyOrderReadyFeeAmount, prescriptionDecodedFeeAmount, updatedByUserId);
    await _dbContext.SaveChangesAsync(cancellationToken);
  }

  public async Task<PaymentSettingsSnapshot> GetSnapshotAsync(CancellationToken cancellationToken = default)
  {
    var entity = await _dbContext.PaymentSettings
      .AsNoTracking()
      .FirstOrDefaultAsync(x => x.Id == PaymentSettings.SingletonId, cancellationToken);
    var dbUrl = entity?.DcBaseUrl;
    var alifTemplate = entity?.AlifUrlTemplate;
    var eskhataTemplate = entity?.EskhataUrlTemplate;
    var alifTemplateEffective = NormalizeAlifTemplate(alifTemplate, _options.AlifUrlTemplate);
    return new PaymentSettingsSnapshot
    {
      DcBaseUrl = dbUrl,
      DcBaseUrlEffective = string.IsNullOrWhiteSpace(dbUrl) ? _options.BaseUrl : dbUrl,
      AlifUrlTemplate = alifTemplate,
      AlifUrlTemplateEffective = alifTemplateEffective,
      EskhataUrlTemplate = eskhataTemplate,
      EskhataUrlTemplateEffective = string.IsNullOrWhiteSpace(eskhataTemplate) ? _options.EskhataUrlTemplate : eskhataTemplate,
      IsDcEnabled = entity?.IsDcEnabled ?? true,
      IsAlifEnabled = entity?.IsAlifEnabled ?? true,
      IsEskhataEnabled = entity?.IsEskhataEnabled ?? true,
      PharmacyOrderReadyFeeAmount = entity?.PharmacyOrderReadyFeeAmount ?? 0m,
      PrescriptionDecodedFeeAmount = entity?.PrescriptionDecodedFeeAmount ?? 0m,
      UpdatedAtUtc = entity?.UpdatedAtUtc ?? DateTime.UtcNow,
      UpdatedByUserId = entity?.UpdatedByUserId
    };
  }

  private static string NormalizeAlifTemplate(string? urlTemplate, string fallback)
  {
    var trimmed = urlTemplate?.Trim();
    if (string.IsNullOrWhiteSpace(trimmed))
      return fallback;

    if (trimmed.StartsWith(LegacyAlifDeepLinkPrefix, StringComparison.OrdinalIgnoreCase))
      return NormalizeAlifAccountPlus(AlifDynamicLinkPrefix + trimmed[LegacyAlifDeepLinkPrefix.Length..]);

    if (trimmed.StartsWith(LegacyAlifHostDeepLinkPrefix, StringComparison.OrdinalIgnoreCase))
      return NormalizeAlifAccountPlus(AlifDynamicLinkPrefix + trimmed[LegacyAlifHostDeepLinkPrefix.Length..]);

    if (trimmed.StartsWith(AlifDynamicLinkPrefix, StringComparison.OrdinalIgnoreCase))
      return NormalizeAlifAccountPlus(trimmed);

    return trimmed;
  }

  private static string NormalizeAlifAccountPlus(string urlTemplate)
    => urlTemplate.Replace("account=+", "account=%2B", StringComparison.OrdinalIgnoreCase);

  private async Task<PaymentSettings> GetOrCreateSettingsAsync(CancellationToken cancellationToken)
  {
    var entity = await _dbContext.PaymentSettings
      .AsTracking()
      .FirstOrDefaultAsync(x => x.Id == PaymentSettings.SingletonId, cancellationToken);

    if (entity is not null)
      return entity;

    entity = new PaymentSettings(PaymentSettings.SingletonId);
    _dbContext.PaymentSettings.Add(entity);
    return entity;
  }
}
