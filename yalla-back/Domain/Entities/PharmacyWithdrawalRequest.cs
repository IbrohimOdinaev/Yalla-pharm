using Yalla.Domain.Enums;
using Yalla.Domain.Exceptions;

namespace Yalla.Domain.Entities;

public sealed class PharmacyWithdrawalRequest
{
  public const int MaxWalletPhoneLength = 32;
  public const int MaxReceiptImageKeyLength = 512;
  public const int MaxSuperAdminCommentLength = 512;
  public const int MaxDeepLinkLength = 2048;

  public Guid Id { get; private set; }
  public Guid PharmacyId { get; private set; }
  public Guid RequestedByAdminId { get; private set; }
  public decimal Amount { get; private set; }
  public string Currency { get; private set; } = "TJS";
  public PharmacyWithdrawalBank Bank { get; private set; }
  public string WalletPhoneNumber { get; private set; } = string.Empty;
  public string DeepLinkUrl { get; private set; } = string.Empty;
  public PharmacyWithdrawalStatus Status { get; private set; } = PharmacyWithdrawalStatus.New;
  public DateTime CreatedAtUtc { get; private set; }
  public DateTime? CompletedAtUtc { get; private set; }
  public Guid? CompletedBySuperAdminId { get; private set; }
  public string? ReceiptImageKey { get; private set; }
  public string? SuperAdminComment { get; private set; }

  private PharmacyWithdrawalRequest() { }

  public PharmacyWithdrawalRequest(
    Guid pharmacyId,
    Guid requestedByAdminId,
    decimal amount,
    PharmacyWithdrawalBank bank,
    string walletPhoneNumber,
    string deepLinkUrl,
    string currency = "TJS")
  {
    if (pharmacyId == Guid.Empty)
      throw new DomainArgumentException("PharmacyId can't be empty.");
    if (requestedByAdminId == Guid.Empty)
      throw new DomainArgumentException("RequestedByAdminId can't be empty.");
    if (amount <= 0)
      throw new DomainArgumentException("Withdrawal amount must be positive.");

    Id = Guid.NewGuid();
    PharmacyId = pharmacyId;
    RequestedByAdminId = requestedByAdminId;
    Amount = decimal.Round(amount, 2, MidpointRounding.AwayFromZero);
    Currency = NormalizeCurrency(currency);
    Bank = bank;
    WalletPhoneNumber = NormalizeWalletPhone(walletPhoneNumber);
    DeepLinkUrl = NormalizeRequiredString(deepLinkUrl, MaxDeepLinkLength, "DeepLinkUrl");
    CreatedAtUtc = DateTime.UtcNow;
  }

  public void Complete(Guid superAdminId, string receiptImageKey, string? comment = null)
  {
    if (superAdminId == Guid.Empty)
      throw new DomainArgumentException("SuperAdminId can't be empty.");
    if (Status != PharmacyWithdrawalStatus.New)
      throw new DomainException("Withdrawal request is already completed.");

    CompletedBySuperAdminId = superAdminId;
    ReceiptImageKey = NormalizeRequiredString(receiptImageKey, MaxReceiptImageKeyLength, "ReceiptImageKey");
    SuperAdminComment = NormalizeOptionalString(comment, MaxSuperAdminCommentLength);
    CompletedAtUtc = DateTime.UtcNow;
    Status = PharmacyWithdrawalStatus.Completed;
  }

  private static string NormalizeCurrency(string currency)
  {
    var normalized = string.IsNullOrWhiteSpace(currency) ? "TJS" : currency.Trim().ToUpperInvariant();
    if (normalized.Length is < 3 or > 8)
      throw new DomainArgumentException("Currency must be between 3 and 8 characters.");
    return normalized;
  }

  private static string NormalizeWalletPhone(string walletPhoneNumber)
  {
    var normalized = NormalizeRequiredString(walletPhoneNumber, MaxWalletPhoneLength, "WalletPhoneNumber")
      .Replace(" ", string.Empty)
      .Replace("-", string.Empty)
      .Replace("(", string.Empty)
      .Replace(")", string.Empty);

    if (normalized.StartsWith("+", StringComparison.Ordinal))
      normalized = normalized[1..];

    if (!normalized.All(char.IsDigit))
      throw new DomainArgumentException("WalletPhoneNumber must contain digits only.");
    if (normalized.Length < 9)
      throw new DomainArgumentException("WalletPhoneNumber is too short.");

    return normalized;
  }

  private static string NormalizeRequiredString(string value, int maxLength, string name)
  {
    if (string.IsNullOrWhiteSpace(value))
      throw new DomainArgumentException($"{name} can't be null or whitespace.");

    var normalized = value.Trim();
    if (normalized.Length > maxLength)
      throw new DomainArgumentException($"{name} can't exceed {maxLength} characters.");

    return normalized;
  }

  private static string? NormalizeOptionalString(string? value, int maxLength)
  {
    if (string.IsNullOrWhiteSpace(value)) return null;
    var normalized = value.Trim();
    if (normalized.Length > maxLength)
      throw new DomainArgumentException($"Comment can't exceed {maxLength} characters.");
    return normalized;
  }
}
