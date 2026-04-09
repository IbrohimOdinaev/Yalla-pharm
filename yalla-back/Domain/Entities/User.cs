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

    internal User(Guid id, string name, long telegramId, Role role)
    {
        if (id == Guid.Empty)
            throw new DomainArgumentException("User.Id can't be empty.");

        Id = id;
        Name = name ?? string.Empty;
        PhoneNumber = $"tg_{telegramId}";
        PasswordHash = "TELEGRAM_AUTH";
        TelegramId = telegramId;
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

}
