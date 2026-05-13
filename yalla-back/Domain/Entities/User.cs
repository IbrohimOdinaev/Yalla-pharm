using Yalla.Domain.Exceptions;
using Yalla.Domain.Enums;

namespace Yalla.Domain.Entities;

public class User
{
    public Guid Id { get; private protected set; }

    public string Name { get; private protected set; } = string.Empty;

    public string PhoneNumber { get; private protected set; } = string.Empty;

    public string PasswordHash { get; private protected set; } = string.Empty;

    public Role Role { get; init; }

    public Gender? Gender { get; private protected set; }

    public DateOnly? DateOfBirth { get; private protected set; }

    public long? TelegramId { get; private protected set; }

    public string? TelegramUsername { get; private protected set; }

    /// <summary>Per-account active flag. False blocks login and any
    /// already-issued access token after a short cache window (~60s)
    /// via the JWT validation handler. Clients are always active —
    /// the flag exists for staff accounts (PharmacyWorker /
    /// Pharmacist) but lives on the base class so future role types
    /// inherit the behaviour for free.</summary>
    public bool IsActive { get; private protected set; } = true;

    public DateTime? DeactivatedAtUtc { get; private protected set; }

    public Guid? DeactivatedByUserId { get; private protected set; }

    public string? DeactivationReason { get; private protected set; }

    private protected User() { }

    public User(
      Guid id,
      string name,
      string phoneNumber,
      string passwordHash,
      Role? role)
    {
        if (id == Guid.Empty)
            throw new DomainArgumentException("User.Id can't be empty.");

        if (string.IsNullOrWhiteSpace(phoneNumber))
            throw new DomainArgumentException("User.PhoneNumber can't be null or whitespace.");

        if (!phoneNumber.All(char.IsDigit))
            throw new DomainArgumentException("User.PhoneNumber must contain digits only.");

        if (string.IsNullOrWhiteSpace(passwordHash))
            throw new DomainArgumentException("User.PasswordHash can't be null or whitespace.");

        Id = id;
        Name = name ?? string.Empty;
        PasswordHash = passwordHash;
        if (role is null) Role = Role.SuperAdmin;
        else Role = role.Value;
        PhoneNumber = phoneNumber;
    }

    internal User(Guid id, string name, long telegramId, string? telegramUsername, Role role)
    {
        if (id == Guid.Empty)
            throw new DomainArgumentException("User.Id can't be empty.");

        Id = id;
        Name = name ?? string.Empty;
        PhoneNumber = $"tg_{telegramId}";
        PasswordHash = "TELEGRAM_AUTH";
        TelegramId = telegramId;
        TelegramUsername = string.IsNullOrWhiteSpace(telegramUsername) ? null : telegramUsername.Trim();
        Role = role;
    }

    internal User(Guid id, string name, string phoneNumber, Role role)
    {
        if (id == Guid.Empty)
            throw new DomainArgumentException("User.Id can't be empty.");

        if (string.IsNullOrWhiteSpace(phoneNumber))
            throw new DomainArgumentException("User.PhoneNumber can't be null or whitespace.");

        if (!phoneNumber.All(char.IsDigit))
            throw new DomainArgumentException("User.PhoneNumber must contain digits only.");

        Id = id;
        Name = name ?? string.Empty;
        PhoneNumber = phoneNumber;
        PasswordHash = "OTP_AUTH";
        Role = role;
    }

    public void SetTelegramId(long? telegramId) => TelegramId = telegramId;

    public void SetTelegramUsername(string? telegramUsername)
    {
        TelegramUsername = string.IsNullOrWhiteSpace(telegramUsername) ? null : telegramUsername.Trim();
    }

    public void SetName(string? name)
    {
        Name = name ?? string.Empty;
    }

    public void SetPhoneNumber(string phoneNumber)
    {
        if (string.IsNullOrWhiteSpace(phoneNumber))
            throw new DomainArgumentException("User.PhoneNumber can't be null or whitespace.");

        if (!phoneNumber.All(char.IsDigit))
            throw new DomainArgumentException("User.PhoneNumber must contain digits only.");

        PhoneNumber = phoneNumber;
    }

    public void SetPasswordHash(string passwordHash)
    {
        if (string.IsNullOrWhiteSpace(passwordHash))
            throw new DomainArgumentException("User.PasswordHash can't be null or whitespace.");

        PasswordHash = passwordHash;
    }

    public void SetGender(Gender? gender)
    {
        Gender = gender;
    }

    public void SetDateOfBirth(DateOnly? dateOfBirth)
    {
        DateOfBirth = dateOfBirth;
    }

    /// <summary>
    /// Mark this account inactive. Subsequent login attempts are
    /// rejected with the same error code as a wrong password (to
    /// avoid account enumeration). Already-issued access tokens stop
    /// working within ~60 seconds via the JWT validation handler's
    /// IMemoryCache window.
    /// </summary>
    /// <param name="deactivatedByUserId">Acting SuperAdmin.</param>
    /// <param name="reason">Free-form reason captured for audit/UI.
    /// Truncated to 500 chars.</param>
    /// <param name="deactivatedAtUtc">UTC timestamp.</param>
    public void Deactivate(Guid deactivatedByUserId, string? reason, DateTime deactivatedAtUtc)
    {
        if (deactivatedByUserId == Guid.Empty)
            throw new DomainArgumentException("DeactivatedByUserId can't be empty.");

        IsActive = false;
        DeactivatedByUserId = deactivatedByUserId;
        DeactivatedAtUtc = deactivatedAtUtc.Kind == DateTimeKind.Utc
            ? deactivatedAtUtc
            : DateTime.SpecifyKind(deactivatedAtUtc, DateTimeKind.Utc);
        DeactivationReason = string.IsNullOrWhiteSpace(reason)
            ? null
            : reason.Trim().Length > 500
                ? reason.Trim()[..500]
                : reason.Trim();
    }

    /// <summary>
    /// Restore an inactive account. Clears deactivation metadata so
    /// future deactivations don't see stale state if the account is
    /// re-deactivated later — each deactivation event should be a
    /// fresh capture.
    /// </summary>
    public void Activate(Guid activatedByUserId)
    {
        if (activatedByUserId == Guid.Empty)
            throw new DomainArgumentException("ActivatedByUserId can't be empty.");

        IsActive = true;
        DeactivatedAtUtc = null;
        DeactivatedByUserId = null;
        DeactivationReason = null;
    }
}
