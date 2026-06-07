using Microsoft.EntityFrameworkCore;
using Yalla.Application.Abstractions;
using Yalla.Application.DTO.Request;
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

    var pending = await _dbContext.StaffCompensationPayoutRequests
      .AsNoTracking()
      .Where(x => ids.Contains(x.StaffUserId) && x.Status == PharmacyWithdrawalStatus.New)
      .GroupBy(x => x.StaffUserId)
      .Select(g => new { StaffUserId = g.Key, Amount = g.Sum(x => x.Amount) })
      .ToListAsync(cancellationToken);

    var earnedById = earned.ToDictionary(x => x.StaffUserId);
    var paidById = paid.ToDictionary(x => x.StaffUserId, x => x.Amount);
    var pendingById = pending.ToDictionary(x => x.StaffUserId, x => x.Amount);

    return ids.ToDictionary(
      id => id,
      id =>
      {
        earnedById.TryGetValue(id, out var earnedRow);
        paidById.TryGetValue(id, out var paidAmount);
        pendingById.TryGetValue(id, out var pendingAmount);
        var earnedAmount = decimal.Round(earnedRow?.Amount ?? 0m, 2, MidpointRounding.AwayFromZero);
        paidAmount = decimal.Round(paidAmount, 2, MidpointRounding.AwayFromZero);
        pendingAmount = decimal.Round(pendingAmount, 2, MidpointRounding.AwayFromZero);
        return new StaffCompensationSummaryResponse
        {
          StaffUserId = id,
          StaffRole = roles.GetValueOrDefault(id).ToString(),
          EarnedWorkItemsCount = earnedRow?.Count ?? 0,
          EarnedAmount = earnedAmount,
          PaidAmount = paidAmount,
          PendingPayoutAmount = pendingAmount,
          BalanceAmount = decimal.Round(earnedAmount - paidAmount - pendingAmount, 2, MidpointRounding.AwayFromZero),
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

    var payoutRequests = await BuildPayoutRequestQuery()
      .Where(x => x.StaffUserId == staffUserId)
      .OrderByDescending(x => x.CreatedAtUtc)
      .Take(20)
      .ToListAsync(cancellationToken);

    return new StaffCompensationMeResponse
    {
      Summary = summary,
      RecentEarnings = earnings,
      RecentPayouts = payouts,
      RecentPayoutRequests = payoutRequests
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

  public async Task<StaffCompensationPayoutRequestResponse> CreatePayoutRequestAsync(
    Guid staffUserId,
    CreateStaffPayoutRequestRequest request,
    CancellationToken cancellationToken = default)
  {
    ArgumentNullException.ThrowIfNull(request);

    var user = await _dbContext.Users
      .AsNoTracking()
      .FirstOrDefaultAsync(x => x.Id == staffUserId, cancellationToken)
      ?? throw new InvalidOperationException("Сотрудник не найден.");

    if (user.Role is not Role.Admin and not Role.Pharmacist)
      throw new InvalidOperationException("Заявка на выплату доступна только админам аптек и фармацевтам.");

    var balance = (await GetSummaryAsync(staffUserId, cancellationToken)).BalanceAmount;
    if (balance <= 0)
      throw new InvalidOperationException("Нет доступной суммы для выплаты.");

    var bank = ParseBank(request.Bank);
    var payoutRequest = new StaffCompensationPayoutRequest(
      staffUserId,
      user.Role,
      balance,
      bank,
      request.WalletPhoneNumber,
      BuildDeepLink(bank, request.WalletPhoneNumber, balance),
      Currency);

    _dbContext.StaffCompensationPayoutRequests.Add(payoutRequest);
    await _dbContext.SaveChangesAsync(cancellationToken);

    return await BuildPayoutRequestQuery()
      .FirstAsync(x => x.Id == payoutRequest.Id, cancellationToken);
  }

  public async Task<IReadOnlyList<StaffCompensationPayoutRequestResponse>> GetPayoutRequestsForSuperAdminAsync(
    CancellationToken cancellationToken = default)
  {
    return await BuildPayoutRequestQuery()
      .OrderBy(x => x.Status == PharmacyWithdrawalStatus.Completed.ToString())
      .ThenByDescending(x => x.CreatedAtUtc)
      .ToListAsync(cancellationToken);
  }

  public async Task<StaffCompensationPayoutRequestResponse> CompletePayoutRequestAsync(
    Guid superAdminId,
    Guid payoutRequestId,
    string receiptImageKey,
    string? note,
    CancellationToken cancellationToken = default)
  {
    if (superAdminId == Guid.Empty)
      throw new DomainArgumentException("SuperAdminId can't be empty.");

    var request = await _dbContext.StaffCompensationPayoutRequests
      .AsTracking()
      .FirstOrDefaultAsync(x => x.Id == payoutRequestId, cancellationToken)
      ?? throw new InvalidOperationException("Заявка на выплату не найдена.");

    if (request.Status != PharmacyWithdrawalStatus.New)
      throw new InvalidOperationException("Заявка уже выполнена.");

    var payout = new StaffCompensationPayout(
      request.StaffUserId,
      request.StaffRole,
      request.Amount,
      StaffPayoutMethod.Transfer,
      superAdminId,
      request.Currency,
      receiptImageKey,
      note);

    _dbContext.StaffCompensationPayouts.Add(payout);
    request.Complete(superAdminId, payout.Id, receiptImageKey, note);
    await _dbContext.SaveChangesAsync(cancellationToken);

    return await BuildPayoutRequestQuery()
      .FirstAsync(x => x.Id == request.Id, cancellationToken);
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

  public async Task<ManualLookupImageContent> GetPayoutRequestReceiptContentAsync(
    Guid payoutRequestId,
    Guid requesterId,
    Role requesterRole,
    CancellationToken cancellationToken = default)
  {
    var request = await _dbContext.StaffCompensationPayoutRequests
      .AsNoTracking()
      .FirstOrDefaultAsync(x => x.Id == payoutRequestId, cancellationToken)
      ?? throw new InvalidOperationException("Заявка на выплату не найдена.");

    if (requesterRole != Role.SuperAdmin && request.StaffUserId != requesterId)
      throw new UnauthorizedAccessException("Нет доступа к чеку выплаты.");

    if (string.IsNullOrWhiteSpace(request.ReceiptImageKey))
      throw new InvalidOperationException("У заявки нет чека.");

    return await _imageStorage.GetContentAsync(request.ReceiptImageKey, cancellationToken);
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

  private IQueryable<StaffCompensationPayoutRequestResponse> BuildPayoutRequestQuery()
  {
    return from request in _dbContext.StaffCompensationPayoutRequests.AsNoTracking()
      join user in _dbContext.Users.AsNoTracking() on request.StaffUserId equals user.Id
      join worker in _dbContext.PharmacyWorkers.AsNoTracking() on request.StaffUserId equals worker.Id into workerJoin
      from worker in workerJoin.DefaultIfEmpty()
      join pharmacy in _dbContext.Pharmacies.AsNoTracking() on worker.PharmacyId equals pharmacy.Id into pharmacyJoin
      from pharmacy in pharmacyJoin.DefaultIfEmpty()
      select new StaffCompensationPayoutRequestResponse
      {
        Id = request.Id,
        StaffUserId = request.StaffUserId,
        StaffName = user.Name,
        StaffPhoneNumber = user.PhoneNumber,
        StaffRole = request.StaffRole.ToString(),
        PharmacyId = worker == null ? null : worker.PharmacyId,
        PharmacyTitle = pharmacy == null ? null : pharmacy.Title,
        Amount = request.Amount,
        Currency = request.Currency,
        Bank = request.Bank.ToString(),
        BankLabel = BankLabel(request.Bank),
        WalletPhoneNumber = request.WalletPhoneNumber,
        DeepLinkUrl = request.DeepLinkUrl,
        Status = request.Status.ToString(),
        CreatedAtUtc = request.CreatedAtUtc,
        CompletedAtUtc = request.CompletedAtUtc,
        CompletedBySuperAdminId = request.CompletedBySuperAdminId,
        PayoutId = request.PayoutId,
        ReceiptImageUrl = request.ReceiptImageKey == null ? null : $"/api/staff-compensation/payout-requests/{request.Id}/receipt/content",
        Note = request.Note
      };
  }

  private static PharmacyWithdrawalBank ParseBank(string? bank)
  {
    if (Enum.TryParse<PharmacyWithdrawalBank>(bank, ignoreCase: true, out var parsed))
      return parsed;

    var normalized = (bank ?? string.Empty).Trim().ToLowerInvariant();
    return normalized switch
    {
      "dc" or "dushanbe" or "dushanbecity" or "dushanbe city" or "душанбе" => PharmacyWithdrawalBank.DushanbeCity,
      "alif" or "алиф" => PharmacyWithdrawalBank.Alif,
      "eskhata" or "esxata" or "эсхата" => PharmacyWithdrawalBank.Eskhata,
      _ => throw new InvalidOperationException("Выберите банк: DushanbeCity, Alif или Eskhata.")
    };
  }

  private static string BuildDeepLink(PharmacyWithdrawalBank bank, string walletPhoneNumber, decimal amount)
  {
    var phone = NormalizePhoneForLink(walletPhoneNumber);
    var amountText = decimal.Round(amount, 2, MidpointRounding.AwayFromZero).ToString("0.00", System.Globalization.CultureInfo.InvariantCulture);
    return bank switch
    {
      PharmacyWithdrawalBank.DushanbeCity => $"dushanbecity://transfer?phone={phone}&amount={amountText}",
      PharmacyWithdrawalBank.Alif => $"alifmobi:///toMobi?account=%2B{phone}&summa={amountText}&_imcp=1",
      PharmacyWithdrawalBank.Eskhata => $"eskhata://service/96e8b785-b1b9-11e8-904b-b06ebfbfa715/{phone}/{amountText}/DA00126FM",
      _ => throw new ArgumentOutOfRangeException(nameof(bank), bank, null)
    };
  }

  private static string NormalizePhoneForLink(string phone)
  {
    var normalized = (phone ?? string.Empty).Trim()
      .Replace(" ", string.Empty)
      .Replace("-", string.Empty)
      .Replace("(", string.Empty)
      .Replace(")", string.Empty);
    if (normalized.StartsWith("+", StringComparison.Ordinal))
      normalized = normalized[1..];
    if (!normalized.All(char.IsDigit) || normalized.Length < 9)
      throw new DomainArgumentException("WalletPhoneNumber must contain a valid phone number.");
    return normalized;
  }

  private static string BankLabel(PharmacyWithdrawalBank bank) => bank switch
  {
    PharmacyWithdrawalBank.DushanbeCity => "Dushanbe City",
    PharmacyWithdrawalBank.Alif => "Alif",
    PharmacyWithdrawalBank.Eskhata => "Eskhata",
    _ => bank.ToString()
  };
}
