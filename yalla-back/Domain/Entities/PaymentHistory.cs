using Yalla.Domain.Exceptions;

namespace Yalla.Domain.Entities;

public sealed class PaymentHistory
{
  public Guid Id { get; private set; }
  public Guid OrderId { get; private set; }
  public Guid? UserId { get; private set; }
  public string UserPhoneNumber { get; private set; } = string.Empty;
  public decimal Amount { get; private set; }
  public string Currency { get; private set; } = string.Empty;
  public string Provider { get; private set; } = string.Empty;
  public string ReceiverAccount { get; private set; } = string.Empty;
  public string? PaymentUrl { get; private set; }
  public string? PaymentComment { get; private set; }
  public Guid ConfirmedByUserId { get; private set; }
  public string ConfirmedByPhoneNumber { get; private set; } = string.Empty;
  public DateTime PaidAtUtc { get; private set; }

  private PaymentHistory()
  {
  }

  public PaymentHistory(
    Guid orderId,
    Guid? userId,
    string userPhoneNumber,
    decimal amount,
    string currency,
    string provider,
    string receiverAccount,
    string? paymentUrl,
    string? paymentComment,
    Guid confirmedByUserId,
    string confirmedByPhoneNumber,
    DateTime paidAtUtc)
  {
    if (orderId == Guid.Empty)
      throw new DomainArgumentException("OrderId can't be empty.");

    if (amount <= 0)
      throw new DomainArgumentException("Amount must be greater than zero.");

    if (confirmedByUserId == Guid.Empty)
      throw new DomainArgumentException("ConfirmedByUserId can't be empty.");

    var normalizedCurrency = NormalizeRequired(currency, 8, "Currency");
    var normalizedProvider = NormalizeRequired(provider, 64, "Provider");
    var normalizedReceiverAccount = NormalizeRequired(receiverAccount, 128, "ReceiverAccount");
    var normalizedUserPhoneNumber = NormalizePhoneNumber(userPhoneNumber, "UserPhoneNumber");
    var normalizedConfirmedByPhoneNumber = NormalizePhoneNumber(confirmedByPhoneNumber, "ConfirmedByPhoneNumber");
    var normalizedPaymentUrl = NormalizeOptional(paymentUrl, 2048, "PaymentUrl");
    var normalizedPaymentComment = NormalizeOptional(paymentComment, 512, "PaymentComment");

    Id = Guid.NewGuid();
    OrderId = orderId;
    UserId = userId;
    UserPhoneNumber = normalizedUserPhoneNumber;
    Amount = amount;
    Currency = normalizedCurrency.ToUpperInvariant();
    Provider = normalizedProvider;
    ReceiverAccount = normalizedReceiverAccount;
    PaymentUrl = normalizedPaymentUrl;
    PaymentComment = normalizedPaymentComment;
    ConfirmedByUserId = confirmedByUserId;
    ConfirmedByPhoneNumber = normalizedConfirmedByPhoneNumber;
    PaidAtUtc = paidAtUtc;
  }

  private static string NormalizeRequired(string value, int maxLength, string fieldName)
  {
    if (string.IsNullOrWhiteSpace(value))
      throw new DomainArgumentException($"{fieldName} can't be null or whitespace.");

    var normalized = value.Trim();
    if (normalized.Length > maxLength)
      throw new DomainArgumentException($"{fieldName} length can't exceed {maxLength}.");

    return normalized;
  }

  private static string? NormalizeOptional(string? value, int maxLength, string fieldName)
  {
    if (value is null)
      return null;

    var normalized = value.Trim();
    if (normalized.Length == 0)
      return null;

    if (normalized.Length > maxLength)
      throw new DomainArgumentException($"{fieldName} length can't exceed {maxLength}.");

    return normalized;
  }

  private static string NormalizePhoneNumber(string phoneNumber, string fieldName)
  {
    // Phone is optional — Telegram-only clients/admins may not have one.
    if (string.IsNullOrWhiteSpace(phoneNumber))
      return string.Empty;

    var digitsOnly = new string(phoneNumber.Where(char.IsDigit).ToArray());
    if (digitsOnly.StartsWith("992", StringComparison.Ordinal) && digitsOnly.Length == 12)
      digitsOnly = digitsOnly[3..];

    if (digitsOnly.Length != 9)
      throw new DomainArgumentException($"{fieldName} must contain exactly 9 digits.");

    return digitsOnly;
  }
}
