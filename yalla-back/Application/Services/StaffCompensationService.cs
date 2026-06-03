using Microsoft.EntityFrameworkCore;
using Yalla.Application.Abstractions;
using Yalla.Application.DTO.Response;
using Yalla.Domain.Entities;
using Yalla.Domain.Enums;
using Yalla.Domain.Exceptions;

namespace Yalla.Application.Services;

public sealed class StaffCompensationService : IStaffCompensationService
{
  private const string Currency = "TJS";

  private readonly IAppDbContext _dbContext;
  private readonly IManualLookupImageStorage _imageStorage;

  public StaffCompensationService(IAppDbContext dbContext, IManualLookupImageStorage imageStorage)
  {
    _dbContext = dbContext;
    _imageStorage = imageStorage;
  }

  public async Task EnsureOrderReadyEarningAsync(
    Guid workerId,
    Guid orderId,
    Guid pharmacyId,
    CancellationToken cancellationToken = default)
  {
    if (workerId == Guid.Empty)
      throw new DomainArgumentException("WorkerId can't be empty.");
    if (orderId == Guid.Empty)
      throw new DomainArgumentException("OrderId can't be empty.");
    if (pharmacyId == Guid.Empty)
      throw new DomainArgumentException("PharmacyId can't be empty.");

    var exists = await _dbContext.StaffCompensationEarnings
      .AnyAsync(x => x.SourceType == StaffCompensationSourceType.OrderReady && x.SourceId == orderId, cancellationToken);
    if (exists)
      return;

    var settings = await GetSettingsAsync(cancellationToken);
    _dbContext.StaffCompensationEarnings.Add(new StaffCompensationEarning(
      workerId,
      Role.Admin,
      StaffCompensationSourceType.OrderReady,
      orderId,
      settings.PharmacyOrderReadyFeeAmount,
      Currency,
      pharmacyId));
  }

  public async Task EnsurePrescriptionDecodedEarningAsync(
    Guid pharmacistId,
    Guid prescriptionId,
    CancellationToken cancellationToken = default)
  {
    if (pharmacistId == Guid.Empty)
      throw new DomainArgumentException("PharmacistId can't be empty.");
    if (prescriptionId == Guid.Empty)
      throw new DomainArgumentException("PrescriptionId can't be empty.");

    var exists = await _dbContext.StaffCompensationEarnings
      .AnyAsync(x => x.SourceType == StaffCompensationSourceType.PrescriptionDecoded && x.SourceId == prescriptionId, cancellationToken);
    if (exists)
      return;

    var settings = await GetSettingsAsync(cancellationToken);
    _dbContext.StaffCompensationEarnings.Add(new StaffCompensationEarning(
      pharmacistId,
      Role.Pharmacist,
      StaffCompensationSourceType.PrescriptionDecoded,
      prescriptionId,
      settings.PrescriptionDecodedFeeAmount,
      Currency));
  }

  public async Task<StaffCompensationSummaryResponse> GetSummaryAsync(
    Guid staffUserId,
    CancellationToken cancellationToken = default)
  {
    var summaries = await GetSummariesAsync(new[] { staffUserId }, cancellationToken);
    return summaries.TryGetValue(staffUserId, out var summary)
      ? summary
      : await BuildEmptySummaryAsync(staffUserId, cancellationToken);
  }

  public async Task<IReadOnlyDictionary<Guid, StaffCompensationSummaryResponse>> GetSummariesAsync(
    IReadOnlyCollection<Guid> staffUserIds,
    CancellationToken cancellationToken = default)
  {
    if (staffUserIds.Count == 0)
      return new Dictionary<Guid, StaffCompensationSummaryResponse>();

    var ids = staffUserIds.Where(x => x != Guid.Empty).Distinct().ToList();
    var roles = await _dbContext.Users
      .AsNoTracking()
      .Where(x => ids.Contains(x.Id))
      .Select(x => new { x.Id, x.Role })
      .ToDictionaryAsync(x => x.Id, x => x.Role, cancellationToken);

    var earned = await _dbContext.StaffCompensationEarnings
      .AsNoTracking()
      .Where(x => ids.Contains(x.StaffUserId))
      .GroupBy(x => x.StaffUserId)
      .Select(g => new { StaffUserId = g.Key, Count = g.Count(), Amount = g.Sum(x => x.Amount) })
      .ToListAsync(cancellationToken);

    var paid = await _dbContext.StaffCompensationPayouts
      .AsNoTracking()
      .Where(x => ids.Contains(x.StaffUserId))
      .GroupBy(x => x.StaffUserId)
      .Select(g => new { StaffUserId = g.Key, Amount = g.Sum(x => x.Amount) })
      .ToListAsync(cancellationToken);

    var earnedById = earned.ToDictionary(x => x.StaffUserId);
    var paidById = paid.ToDictionary(x => x.StaffUserId, x => x.Amount);

    return ids.ToDictionary(
      id => id,
      id =>
      {
        earnedById.TryGetValue(id, out var earnedRow);
        paidById.TryGetValue(id, out var paidAmount);
        var earnedAmount = decimal.Round(earnedRow?.Amount ?? 0m, 2, MidpointRounding.AwayFromZero);
        paidAmount = decimal.Round(paidAmount, 2, MidpointRounding.AwayFromZero);
        return new StaffCompensationSummaryResponse
        {
          StaffUserId = id,
          StaffRole = roles.GetValueOrDefault(id).ToString(),
          EarnedWorkItemsCount = earnedRow?.Count ?? 0,
          EarnedAmount = earnedAmount,
          PaidAmount = paidAmount,
          BalanceAmount = decimal.Round(earnedAmount - paidAmount, 2, MidpointRounding.AwayFromZero),
          Currency = Currency
        };
      });
  }

  public async Task<StaffCompensationMeResponse> GetMeAsync(
    Guid staffUserId,
    CancellationToken cancellationToken = default)
  {
    var summary = await GetSummaryAsync(staffUserId, cancellationToken);

    var earnings = await _dbContext.StaffCompensationEarnings
      .AsNoTracking()
      .Where(x => x.StaffUserId == staffUserId)
      .OrderByDescending(x => x.CreatedAtUtc)
      .Take(20)
      .Select(x => new StaffCompensationEarningResponse
      {
        Id = x.Id,
        SourceType = x.SourceType.ToString(),
        SourceId = x.SourceId,
        Amount = x.Amount,
        Currency = x.Currency,
        CreatedAtUtc = x.CreatedAtUtc
      })
      .ToListAsync(cancellationToken);

    var payouts = await _dbContext.StaffCompensationPayouts
      .AsNoTracking()
      .Where(x => x.StaffUserId == staffUserId)
      .OrderByDescending(x => x.PaidAtUtc)
      .Take(20)
      .Select(x => ToPayoutResponse(x))
      .ToListAsync(cancellationToken);

    return new StaffCompensationMeResponse
    {
      Summary = summary,
      RecentEarnings = earnings,
      RecentPayouts = payouts
    };
  }

  public async Task<StaffCompensationPayoutResponse> CreatePayoutAsync(
    Guid superAdminId,
    Guid staffUserId,
    decimal amount,
    StaffPayoutMethod method,
    string? receiptImageKey,
    string? note,
    CancellationToken cancellationToken = default)
  {
    if (superAdminId == Guid.Empty)
      throw new DomainArgumentException("SuperAdminId can't be empty.");

    var user = await _dbContext.Users
      .AsNoTracking()
      .FirstOrDefaultAsync(x => x.Id == staffUserId, cancellationToken)
      ?? throw new InvalidOperationException("Сотрудник не найден.");

    if (user.Role is not Role.Admin and not Role.Pharmacist)
      throw new InvalidOperationException("Выплата доступна только админам аптек и фармацевтам.");

    var balance = (await GetSummaryAsync(staffUserId, cancellationToken)).BalanceAmount;
    var roundedAmount = decimal.Round(amount, 2, MidpointRounding.AwayFromZero);
    if (roundedAmount > balance)
      throw new InvalidOperationException("Сумма выплаты превышает доступный баланс сотрудника.");

    var payout = new StaffCompensationPayout(
      staffUserId,
      user.Role,
      roundedAmount,
      method,
      superAdminId,
      Currency,
      receiptImageKey,
      note);

    _dbContext.StaffCompensationPayouts.Add(payout);
    await _dbContext.SaveChangesAsync(cancellationToken);

    return ToPayoutResponse(payout);
  }

  public async Task<ManualLookupImageContent> GetPayoutReceiptContentAsync(
    Guid payoutId,
    Guid requesterId,
    Role requesterRole,
    CancellationToken cancellationToken = default)
  {
    var payout = await _dbContext.StaffCompensationPayouts
      .AsNoTracking()
      .FirstOrDefaultAsync(x => x.Id == payoutId, cancellationToken)
      ?? throw new InvalidOperationException("Выплата не найдена.");

    if (requesterRole != Role.SuperAdmin && payout.StaffUserId != requesterId)
      throw new UnauthorizedAccessException("Нет доступа к чеку выплаты.");

    if (string.IsNullOrWhiteSpace(payout.ReceiptImageKey))
      throw new InvalidOperationException("У выплаты нет чека.");

    return await _imageStorage.GetContentAsync(payout.ReceiptImageKey, cancellationToken);
  }

  private async Task<PaymentSettings> GetSettingsAsync(CancellationToken cancellationToken)
  {
    var settings = await _dbContext.PaymentSettings
      .AsNoTracking()
      .FirstOrDefaultAsync(x => x.Id == PaymentSettings.SingletonId, cancellationToken);
    return settings ?? new PaymentSettings(PaymentSettings.SingletonId);
  }

  private async Task<StaffCompensationSummaryResponse> BuildEmptySummaryAsync(
    Guid staffUserId,
    CancellationToken cancellationToken)
  {
    var role = await _dbContext.Users
      .AsNoTracking()
      .Where(x => x.Id == staffUserId)
      .Select(x => x.Role)
      .FirstOrDefaultAsync(cancellationToken);

    return new StaffCompensationSummaryResponse
    {
      StaffUserId = staffUserId,
      StaffRole = role.ToString(),
      Currency = Currency
    };
  }

  private static StaffCompensationPayoutResponse ToPayoutResponse(StaffCompensationPayout payout) => new()
  {
    Id = payout.Id,
    Amount = payout.Amount,
    Currency = payout.Currency,
    Method = payout.Method.ToString(),
    ReceiptImageUrl = string.IsNullOrWhiteSpace(payout.ReceiptImageKey)
      ? null
      : $"/api/staff-compensation/payouts/{payout.Id}/receipt/content",
    Note = payout.Note,
    PaidAtUtc = payout.PaidAtUtc
  };
}
