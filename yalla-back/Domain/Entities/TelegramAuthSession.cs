using Yalla.Domain.Enums;
using Yalla.Domain.Exceptions;

namespace Yalla.Domain.Entities;

public class TelegramAuthSession
{
  public Guid Id { get; private set; }

  public string Nonce { get; private set; } = string.Empty;

  public TelegramAuthSessionStatus Status { get; private set; }

  /// <summary>
  /// When set, the session was initiated by an already-authenticated user who
  /// is linking Telegram to their account — not a fresh login.
  /// </summary>
  public Guid? InitiatingUserId { get; private set; }

  public long? TelegramUserId { get; private set; }
  public string? TelegramUsername { get; private set; }
  public string? TelegramFirstName { get; private set; }
  public string? TelegramLastName { get; private set; }

  /// <summary>
  /// chat_id of the message in the bot where the confirm/cancel buttons live.
  /// Used to edit the message after confirmation.
  /// </summary>
  public long? ConfirmationChatId { get; private set; }
  public int? ConfirmationMessageId { get; private set; }

  public DateTime CreatedAtUtc { get; private set; }
  public DateTime ExpiresAtUtc { get; private set; }
  public DateTime UpdatedAtUtc { get; private set; }
  public DateTime? ConsumedAtUtc { get; private set; }

  private TelegramAuthSession() { }

  public TelegramAuthSession(string nonce, DateTime expiresAtUtc, Guid? initiatingUserId = null)
  {
    if (string.IsNullOrWhiteSpace(nonce))
      throw new DomainArgumentException("TelegramAuthSession.Nonce can't be null or whitespace.");
    if (expiresAtUtc <= DateTime.UtcNow)
      throw new DomainArgumentException("TelegramAuthSession.ExpiresAtUtc must be in the future.");
    if (initiatingUserId.HasValue && initiatingUserId.Value == Guid.Empty)
      throw new DomainArgumentException("TelegramAuthSession.InitiatingUserId can't be empty guid.");

    Id = Guid.NewGuid();
    Nonce = nonce;
    Status = TelegramAuthSessionStatus.Pending;
    CreatedAtUtc = DateTime.UtcNow;
    UpdatedAtUtc = CreatedAtUtc;
    ExpiresAtUtc = expiresAtUtc;
    InitiatingUserId = initiatingUserId;
  }

  public bool IsLinkingSession => InitiatingUserId.HasValue;

  public void RegisterConfirmationMessage(long chatId, int messageId)
  {
    ConfirmationChatId = chatId;
    ConfirmationMessageId = messageId;
    UpdatedAtUtc = DateTime.UtcNow;
  }

  public void Confirm(long telegramUserId, string? username, string? firstName, string? lastName)
  {
    if (Status != TelegramAuthSessionStatus.Pending)
      throw new DomainException($"TelegramAuthSession is not Pending (current: {Status}).");

    TelegramUserId = telegramUserId;
    TelegramUsername = username;
    TelegramFirstName = firstName;
    TelegramLastName = lastName;
    Status = TelegramAuthSessionStatus.Confirmed;
    UpdatedAtUtc = DateTime.UtcNow;
  }

  public void Cancel()
  {
    if (Status != TelegramAuthSessionStatus.Pending)
      return;

    Status = TelegramAuthSessionStatus.Cancelled;
    UpdatedAtUtc = DateTime.UtcNow;
  }

  public void MarkExpired()
  {
    if (Status != TelegramAuthSessionStatus.Pending)
      return;

    Status = TelegramAuthSessionStatus.Expired;
    UpdatedAtUtc = DateTime.UtcNow;
  }

  public void Consume()
  {
    if (Status != TelegramAuthSessionStatus.Confirmed)
      throw new DomainException($"TelegramAuthSession can only be consumed from Confirmed (current: {Status}).");

    Status = TelegramAuthSessionStatus.Consumed;
    UpdatedAtUtc = DateTime.UtcNow;
    ConsumedAtUtc = UpdatedAtUtc;
  }
}
