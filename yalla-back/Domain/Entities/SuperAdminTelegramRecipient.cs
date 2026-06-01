using Yalla.Domain.Exceptions;

namespace Yalla.Domain.Entities;

public sealed class SuperAdminTelegramRecipient
{
  public Guid Id { get; private set; }
  public Guid SuperAdminId { get; private set; }
  public long ChatId { get; private set; }
  public long TelegramUserId { get; private set; }
  public string? TelegramUsername { get; private set; }
  public string? TelegramFirstName { get; private set; }
  public string? TelegramLastName { get; private set; }
  public bool IsActive { get; private set; }
  public DateTime CreatedAtUtc { get; private set; }
  public DateTime UpdatedAtUtc { get; private set; }

  private SuperAdminTelegramRecipient() { }

  public SuperAdminTelegramRecipient(
    Guid superAdminId,
    long chatId,
    long telegramUserId,
    string? telegramUsername,
    string? telegramFirstName,
    string? telegramLastName)
  {
    if (superAdminId == Guid.Empty)
      throw new DomainArgumentException("SuperAdminId can't be empty.");
    if (chatId == 0)
      throw new DomainArgumentException("ChatId can't be zero.");
    if (telegramUserId == 0)
      throw new DomainArgumentException("TelegramUserId can't be zero.");

    Id = Guid.NewGuid();
    SuperAdminId = superAdminId;
    ChatId = chatId;
    TelegramUserId = telegramUserId;
    TelegramUsername = NormalizeOptional(telegramUsername, 128);
    TelegramFirstName = NormalizeOptional(telegramFirstName, 128);
    TelegramLastName = NormalizeOptional(telegramLastName, 128);
    IsActive = true;
    CreatedAtUtc = DateTime.UtcNow;
    UpdatedAtUtc = CreatedAtUtc;
  }

  public void RefreshTelegramProfile(string? username, string? firstName, string? lastName)
  {
    TelegramUsername = NormalizeOptional(username, 128);
    TelegramFirstName = NormalizeOptional(firstName, 128);
    TelegramLastName = NormalizeOptional(lastName, 128);
    IsActive = true;
    UpdatedAtUtc = DateTime.UtcNow;
  }

  public void Deactivate()
  {
    IsActive = false;
    UpdatedAtUtc = DateTime.UtcNow;
  }

  private static string? NormalizeOptional(string? value, int maxLength)
  {
    if (string.IsNullOrWhiteSpace(value))
      return null;

    var normalized = value.Trim().TrimStart('@');
    return normalized.Length > maxLength ? normalized[..maxLength] : normalized;
  }
}
