using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using Yalla.Application.Abstractions;
using Yalla.Application.Common;
using Yalla.Domain.Entities;

namespace Yalla.Application.Services;

public sealed class PaymentSettingsService : IPaymentSettingsService
{
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

  public async Task<PaymentSettingsSnapshot> GetSnapshotAsync(CancellationToken cancellationToken = default)
  {
    var entity = await _dbContext.PaymentSettings
      .AsNoTracking()
      .FirstOrDefaultAsync(x => x.Id == PaymentSettings.SingletonId, cancellationToken);
    var dbUrl = entity?.DcBaseUrl;
    var alifTemplate = entity?.AlifUrlTemplate;
    var eskhataTemplate = entity?.EskhataUrlTemplate;
    return new PaymentSettingsSnapshot
    {
      DcBaseUrl = dbUrl,
      DcBaseUrlEffective = string.IsNullOrWhiteSpace(dbUrl) ? _options.BaseUrl : dbUrl,
      AlifUrlTemplate = alifTemplate,
      AlifUrlTemplateEffective = string.IsNullOrWhiteSpace(alifTemplate) ? _options.AlifUrlTemplate : alifTemplate,
      EskhataUrlTemplate = eskhataTemplate,
      EskhataUrlTemplateEffective = string.IsNullOrWhiteSpace(eskhataTemplate) ? _options.EskhataUrlTemplate : eskhataTemplate,
      UpdatedAtUtc = entity?.UpdatedAtUtc ?? DateTime.UtcNow,
      UpdatedByUserId = entity?.UpdatedByUserId
    };
  }

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
