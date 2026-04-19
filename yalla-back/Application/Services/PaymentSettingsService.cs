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

  public async Task<PaymentSettingsSnapshot> GetSnapshotAsync(CancellationToken cancellationToken = default)
  {
    var entity = await _dbContext.PaymentSettings
      .AsNoTracking()
      .FirstOrDefaultAsync(x => x.Id == PaymentSettings.SingletonId, cancellationToken);
    var dbUrl = entity?.DcBaseUrl;
    return new PaymentSettingsSnapshot
    {
      DcBaseUrl = dbUrl,
      DcBaseUrlEffective = string.IsNullOrWhiteSpace(dbUrl) ? _options.BaseUrl : dbUrl,
      UpdatedAtUtc = entity?.UpdatedAtUtc ?? DateTime.UtcNow,
      UpdatedByUserId = entity?.UpdatedByUserId
    };
  }
}
