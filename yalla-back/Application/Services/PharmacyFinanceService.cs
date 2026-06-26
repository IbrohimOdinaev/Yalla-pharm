using Microsoft.EntityFrameworkCore;
using Yalla.Application.Abstractions;
using Yalla.Application.DTO.Request;
using Yalla.Application.DTO.Response;
using Yalla.Domain.Entities;
using Yalla.Domain.Enums;
using Yalla.Domain.Exceptions;

namespace Yalla.Application.Services;

public sealed class PharmacyFinanceService : IPharmacyFinanceService
{
  private const string Currency = "TJS";
  private static readonly Status[] PayableStatuses = [Status.Delivered, Status.PickedUp, Status.Returned];

  private readonly IAppDbContext _dbContext;
  private readonly IManualLookupImageStorage _imageStorage;

  public PharmacyFinanceService(IAppDbContext dbContext, IManualLookupImageStorage imageStorage)
  {
    ArgumentNullException.ThrowIfNull(dbContext);
    ArgumentNullException.ThrowIfNull(imageStorage);
    _dbContext = dbContext;
    _imageStorage = imageStorage;
  }

  public async Task<PharmacyFinanceResponse> GetForAdminAsync(
    Guid adminId,
    Guid pharmacyId,
    CancellationToken cancellationToken = default)
  {
    await EnsureAdminBelongsToPharmacyAsync(adminId, pharmacyId, cancellationToken);
    return await BuildFinanceResponseAsync(pharmacyId, cancellationToken);
  }

  public async Task<PharmacyFinanceResponse> GetForSuperAdminAsync(CancellationToken cancellationToken = default)
  {
    var requests = await BuildRequestQuery()
      .OrderBy(x => x.Status)
      .ThenByDescending(x => x.CreatedAtUtc)
      .ToListAsync(cancellationToken);

    return new PharmacyFinanceResponse
    {
      Summary = new PharmacyFinanceSummaryResponse { Currency = Currency },
      WithdrawalRequests = requests
    };
  }

  public async Task<PharmacyWithdrawalRequestResponse> CreateWithdrawalRequestAsync(
    Guid adminId,
    Guid pharmacyId,
    CreatePharmacyWithdrawalRequest request,
    CancellationToken cancellationToken = default)
  {
    ArgumentNullException.ThrowIfNull(request);
    await EnsureAdminBelongsToPharmacyAsync(adminId, pharmacyId, cancellationToken);

    var bank = ParseBank(request.Bank);
    var balance = await CalculateSummaryAsync(pharmacyId, cancellationToken);
    if (balance.AvailableAmount <= 0)
      throw new ClientErrorException(
        errorCode: "pharmacy_withdrawal_empty_balance",
        detail: "Нет доступной суммы для вывода.",
        reason: "empty_balance",
        statusCode: 400);

    var deepLink = BuildDeepLink(bank, request.WalletPhoneNumber, balance.AvailableAmount);
    var entity = new PharmacyWithdrawalRequest(
      pharmacyId,
      adminId,
      balance.AvailableAmount,
      bank,
      request.WalletPhoneNumber,
      deepLink,
      Currency);

    _dbContext.PharmacyWithdrawalRequests.Add(entity);
    await _dbContext.SaveChangesAsync(cancellationToken);

    return await BuildRequestQuery().FirstAsync(x => x.Id == entity.Id, cancellationToken);
  }

  public async Task<PharmacyWithdrawalRequestResponse> CompleteWithdrawalRequestAsync(
    Guid superAdminId,
    Guid withdrawalRequestId,
    string receiptImageKey,
    string? comment,
    CancellationToken cancellationToken = default)
  {
    if (superAdminId == Guid.Empty)
      throw new DomainArgumentException("SuperAdminId can't be empty.");

    var entity = await _dbContext.PharmacyWithdrawalRequests
      .AsTracking()
      .FirstOrDefaultAsync(x => x.Id == withdrawalRequestId, cancellationToken)
      ?? throw NotFound();

    entity.Complete(superAdminId, receiptImageKey, comment);
    await _dbContext.SaveChangesAsync(cancellationToken);

    return await BuildRequestQuery().FirstAsync(x => x.Id == entity.Id, cancellationToken);
  }

  public async Task<ManualLookupImageContent> GetReceiptContentAsync(
    Guid withdrawalRequestId,
    Guid requesterId,
    Role requesterRole,
    Guid? requesterPharmacyId,
    CancellationToken cancellationToken = default)
  {
    var request = await _dbContext.PharmacyWithdrawalRequests
      .AsNoTracking()
      .FirstOrDefaultAsync(x => x.Id == withdrawalRequestId, cancellationToken)
      ?? throw NotFound();

    if (requesterRole != Role.SuperAdmin)
    {
      if (requesterRole != Role.PharmacyAccount || requesterPharmacyId is null || requesterPharmacyId.Value != request.PharmacyId)
        throw new UnauthorizedAccessException("Нет доступа к чеку выплаты.");
    }

    if (string.IsNullOrWhiteSpace(request.ReceiptImageKey))
      throw new ClientErrorException(
        errorCode: "pharmacy_withdrawal_receipt_not_found",
        detail: "У заявки нет прикреплённого чека.",
        reason: "not_found",
        statusCode: 404);

    return await _imageStorage.GetContentAsync(request.ReceiptImageKey, cancellationToken);
  }

  private async Task<PharmacyFinanceResponse> BuildFinanceResponseAsync(Guid pharmacyId, CancellationToken cancellationToken)
  {
    var summary = await CalculateSummaryAsync(pharmacyId, cancellationToken);
    var requests = await BuildRequestQuery()
      .Where(x => x.PharmacyId == pharmacyId)
      .OrderByDescending(x => x.CreatedAtUtc)
      .ToListAsync(cancellationToken);

    return new PharmacyFinanceResponse
    {
      Summary = summary,
      WithdrawalRequests = requests
    };
  }

  private async Task<PharmacyFinanceSummaryResponse> CalculateSummaryAsync(Guid pharmacyId, CancellationToken cancellationToken)
  {
    if (pharmacyId == Guid.Empty)
      throw new DomainArgumentException("PharmacyId can't be empty.");

    var pharmacy = await _dbContext.Pharmacies
      .AsNoTracking()
      .Where(x => x.Id == pharmacyId)
      .Select(x => new { x.Id, x.Title })
      .FirstOrDefaultAsync(cancellationToken)
      ?? throw new ClientErrorException("pharmacy_not_found", "Аптека не найдена.", "not_found", 404);

    var orders = await _dbContext.Orders
      .AsNoTracking()
      .Where(x =>
        x.PharmacyId == pharmacyId
        && x.PaymentState == OrderPaymentState.Confirmed
        && PayableStatuses.Contains(x.Status))
      .GroupBy(x => x.PharmacyId)
      .Select(g => new { Count = g.Count(), Amount = g.Sum(x => x.Cost) })
      .FirstOrDefaultAsync(cancellationToken);

    var withdrawals = await _dbContext.PharmacyWithdrawalRequests
      .AsNoTracking()
      .Where(x => x.PharmacyId == pharmacyId)
      .GroupBy(x => x.PharmacyId)
      .Select(g => new
      {
        Completed = g.Where(x => x.Status == PharmacyWithdrawalStatus.Completed).Sum(x => x.Amount),
        Pending = g.Where(x => x.Status == PharmacyWithdrawalStatus.New).Sum(x => x.Amount)
      })
      .FirstOrDefaultAsync(cancellationToken);

    var total = Round(orders?.Amount ?? 0m);
    var completed = Round(withdrawals?.Completed ?? 0m);
    var pending = Round(withdrawals?.Pending ?? 0m);
    var available = Round(total - completed - pending);

    return new PharmacyFinanceSummaryResponse
    {
      PharmacyId = pharmacy.Id,
      PharmacyTitle = pharmacy.Title,
      TotalOrderAmount = total,
      CompletedWithdrawalAmount = completed,
      PendingWithdrawalAmount = pending,
      AvailableAmount = Math.Max(0m, available),
      CompletedOrdersCount = orders?.Count ?? 0,
      Currency = Currency
    };
  }

  private IQueryable<PharmacyWithdrawalRequestResponse> BuildRequestQuery()
  {
    return from request in _dbContext.PharmacyWithdrawalRequests.AsNoTracking()
      join pharmacy in _dbContext.Pharmacies.AsNoTracking() on request.PharmacyId equals pharmacy.Id
      join admin in _dbContext.Users.AsNoTracking() on request.RequestedByAdminId equals admin.Id
      select new PharmacyWithdrawalRequestResponse
      {
        Id = request.Id,
        PharmacyId = request.PharmacyId,
        PharmacyTitle = pharmacy.Title,
        RequestedByAdminId = request.RequestedByAdminId,
        RequestedByAdminName = admin.Name,
        RequestedByAdminPhoneNumber = admin.PhoneNumber,
        Amount = request.Amount,
        Currency = request.Currency,
        Bank = request.Bank,
        BankLabel = BankLabel(request.Bank),
        WalletPhoneNumber = request.WalletPhoneNumber,
        DeepLinkUrl = request.DeepLinkUrl,
        Status = request.Status,
        CreatedAtUtc = request.CreatedAtUtc,
        CompletedAtUtc = request.CompletedAtUtc,
        CompletedBySuperAdminId = request.CompletedBySuperAdminId,
        ReceiptImageUrl = request.ReceiptImageKey == null ? null : $"/api/pharmacy-finance/withdrawals/{request.Id}/receipt/content",
        SuperAdminComment = request.SuperAdminComment
      };
  }

  private async Task EnsureAdminBelongsToPharmacyAsync(Guid adminId, Guid pharmacyId, CancellationToken cancellationToken)
  {
    if (adminId == Guid.Empty)
      throw new DomainArgumentException("AdminId can't be empty.");
    if (pharmacyId == Guid.Empty)
      throw new DomainArgumentException("PharmacyId can't be empty.");

    var allowed = await _dbContext.PharmacyWorkers
      .AsNoTracking()
      .AnyAsync(x => x.Id == adminId && x.PharmacyId == pharmacyId && x.Role == Role.PharmacyAccount, cancellationToken);

    if (!allowed)
      throw new UnauthorizedAccessException("Администратор не привязан к этой аптеке.");
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
      _ => throw new ClientErrorException("pharmacy_withdrawal_bank_invalid", "Выберите банк: DushanbeCity, Alif или Eskhata.", "invalid_bank", 400)
    };
  }

  private static string BuildDeepLink(PharmacyWithdrawalBank bank, string walletPhoneNumber, decimal amount)
  {
    var phone = NormalizePhoneForLink(walletPhoneNumber);
    var amountText = Round(amount).ToString("0.00", System.Globalization.CultureInfo.InvariantCulture);
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

  private static decimal Round(decimal value) => decimal.Round(value, 2, MidpointRounding.AwayFromZero);

  private static ClientErrorException NotFound() => new(
    "pharmacy_withdrawal_not_found",
    "Заявка на вывод средств не найдена.",
    "not_found",
    404);
}
