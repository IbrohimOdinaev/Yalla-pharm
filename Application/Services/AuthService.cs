using Microsoft.EntityFrameworkCore;
using Yalla.Application.Abstractions;
using Yalla.Application.Common;
using Yalla.Application.DTO.Request;
using Yalla.Application.DTO.Response;
using Yalla.Domain.Enums;
using Yalla.Domain.Exceptions;

namespace Yalla.Application.Services;

public sealed class AuthService : IAuthService
{
  private readonly IAppDbContext _dbContext;
  private readonly IPasswordHasher _passwordHasher;
  private readonly IJwtTokenProvider _jwtTokenProvider;

  public AuthService(
    IAppDbContext dbContext,
    IPasswordHasher passwordHasher,
    IJwtTokenProvider jwtTokenProvider)
  {
    ArgumentNullException.ThrowIfNull(dbContext);
    ArgumentNullException.ThrowIfNull(passwordHasher);
    ArgumentNullException.ThrowIfNull(jwtTokenProvider);

    _dbContext = dbContext;
    _passwordHasher = passwordHasher;
    _jwtTokenProvider = jwtTokenProvider;
  }

  public async Task<LoginResponse> LoginAsync(
    LoginRequest request,
    CancellationToken cancellationToken = default)
  {
    ArgumentNullException.ThrowIfNull(request);

    var normalizedPhoneNumber = UserInputPolicy.NormalizePhoneNumber(request.PhoneNumber);
    var user = await _dbContext.Users
      .AsNoTracking()
      .FirstOrDefaultAsync(x => x.PhoneNumber == normalizedPhoneNumber, cancellationToken);

    if (user is null
      || string.IsNullOrWhiteSpace(user.PasswordHash)
      || !_passwordHasher.VerifyPassword(request.Password, user.PasswordHash))
      throw new InvalidOperationException("Invalid phone number or password.");

    Guid? pharmacyId = null;
    if (user.Role == Role.Admin)
    {
      pharmacyId = await _dbContext.PharmacyWorkers
        .AsNoTracking()
        .Where(x => x.Id == user.Id)
        .Select(x => (Guid?)x.PharmacyId)
        .FirstOrDefaultAsync(cancellationToken);

      if (!pharmacyId.HasValue || pharmacyId.Value == Guid.Empty)
      {
        throw new InvalidOperationException(
          $"Admin user '{user.Id}' is not linked to a pharmacy.");
      }
    }

    var token = _jwtTokenProvider.GenerateToken(
      user.Id,
      user.Name,
      user.PhoneNumber,
      user.Role,
      pharmacyId);

    return new LoginResponse
    {
      UserId = user.Id,
      Name = user.Name,
      PhoneNumber = user.PhoneNumber,
      Role = user.Role,
      AccessToken = token.AccessToken,
      ExpiresAtUtc = token.ExpiresAtUtc
    };
  }

  public async Task<ChangePasswordResponse> ChangePasswordAsync(
    Guid userId,
    ChangePasswordRequest request,
    CancellationToken cancellationToken = default)
  {
    ArgumentNullException.ThrowIfNull(request);

    var user = await _dbContext.Users
      .AsTracking()
      .FirstOrDefaultAsync(x => x.Id == userId, cancellationToken)
      ?? throw new InvalidOperationException($"User with id '{userId}' was not found.");

    if (string.IsNullOrWhiteSpace(user.PasswordHash)
      || !_passwordHasher.VerifyPassword(request.CurrentPassword, user.PasswordHash))
      throw new InvalidOperationException("Current password is invalid.");

    UserInputPolicy.EnsureValidPassword(request.NewPassword, nameof(request.NewPassword));
    var newPasswordHash = _passwordHasher.HashPassword(request.NewPassword);
    if (!_passwordHasher.VerifyPassword(request.NewPassword, newPasswordHash))
      throw new InvalidOperationException("Password hashing verification failed.");

    user.SetPasswordHash(newPasswordHash);
    await _dbContext.SaveChangesAsync(cancellationToken);

    return new ChangePasswordResponse
    {
      UserId = user.Id,
      IsChanged = true
    };
  }

  public async Task<UpdateAdminProfileResponse> UpdateAdminProfileAsync(
    Guid adminId,
    UpdateAdminProfileRequest request,
    CancellationToken cancellationToken = default)
  {
    ArgumentNullException.ThrowIfNull(request);

    if (adminId == Guid.Empty)
      throw new DomainArgumentException("AdminId can't be empty.");

    var admin = await _dbContext.Users
      .AsTracking()
      .FirstOrDefaultAsync(x => x.Id == adminId, cancellationToken)
      ?? throw new InvalidOperationException($"Admin user with id '{adminId}' was not found.");

    if (admin.Role != Role.Admin)
      throw new InvalidOperationException($"User '{adminId}' does not have Admin role.");

    var normalizedPhoneNumber = UserInputPolicy.NormalizePhoneNumber(request.PhoneNumber);
    var phoneTaken = await _dbContext.Users
      .AsNoTracking()
      .AnyAsync(x => x.PhoneNumber == normalizedPhoneNumber && x.Id != adminId, cancellationToken);

    if (phoneTaken)
      throw new InvalidOperationException($"User with phone number '{normalizedPhoneNumber}' already exists.");

    admin.SetName(request.Name);
    admin.SetPhoneNumber(normalizedPhoneNumber);
    await _dbContext.SaveChangesAsync(cancellationToken);

    return new UpdateAdminProfileResponse
    {
      AdminId = admin.Id,
      Name = admin.Name,
      PhoneNumber = admin.PhoneNumber,
      Role = admin.Role
    };
  }
}
