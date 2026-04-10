using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Yalla.Application.Abstractions;
using Yalla.Application.Common;
using Yalla.Application.DTO.Request;
using Yalla.Application.DTO.Response;
using Yalla.Domain.Entities;
using Yalla.Domain.Enums;
using Yalla.Domain.Exceptions;

namespace Yalla.Application.Services;

public sealed class AuthService : IAuthService
{
  private const string OtpMessageTemplate = "Код входа в Yalla Farm: {code}";

  private readonly IAppDbContext _dbContext;
  private readonly IPasswordHasher _passwordHasher;
  private readonly IJwtTokenProvider _jwtTokenProvider;
  private readonly ISmsService? _smsService;

  public AuthService(
    IAppDbContext dbContext,
    IPasswordHasher passwordHasher,
    IJwtTokenProvider jwtTokenProvider,
    ISmsService? smsService = null)
  {
    ArgumentNullException.ThrowIfNull(dbContext);
    ArgumentNullException.ThrowIfNull(passwordHasher);
    ArgumentNullException.ThrowIfNull(jwtTokenProvider);

    _dbContext = dbContext;
    _passwordHasher = passwordHasher;
    _jwtTokenProvider = jwtTokenProvider;
    _smsService = smsService;
  }

  private ISmsService RequireSmsService()
  {
    return _smsService ?? throw new InvalidOperationException(
      "ISmsService dependency is required for OTP authentication but was not provided.");
  }

  public Task<LoginResponse> LoginAsync(
    LoginRequest request,
    CancellationToken cancellationToken = default)
    => LoginInternalAsync(request, expectedRole: null, cancellationToken);

  public Task<LoginResponse> AdminLoginAsync(
    LoginRequest request,
    CancellationToken cancellationToken = default)
    => LoginInternalAsync(request, expectedRole: Role.Admin, cancellationToken);

  public Task<LoginResponse> SuperAdminLoginAsync(
    LoginRequest request,
    CancellationToken cancellationToken = default)
    => LoginInternalAsync(request, expectedRole: Role.SuperAdmin, cancellationToken);

  private async Task<LoginResponse> LoginInternalAsync(
    LoginRequest request,
    Role? expectedRole,
    CancellationToken cancellationToken)
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

    if (expectedRole.HasValue && user.Role != expectedRole.Value)
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

  public async Task<RequestClientOtpResponse> RequestClientOtpAsync(
    RequestClientOtpRequest request,
    CancellationToken cancellationToken = default)
  {
    ArgumentNullException.ThrowIfNull(request);

    var normalizedPhoneNumber = UserInputPolicy.NormalizePhoneNumber(request.PhoneNumber);

    var existingClient = await _dbContext.Users
      .AsNoTracking()
      .Where(x => x.PhoneNumber == normalizedPhoneNumber && x.Role == Role.Client)
      .Select(x => new { x.Id })
      .FirstOrDefaultAsync(cancellationToken);

    var isNewClient = existingClient is null;

    var payload = new ClientOtpLoginPayload
    {
      PhoneNumber = normalizedPhoneNumber,
      IsNewClient = isNewClient
    };

    var sendResponse = await RequireSmsService().SendSmsAsync(
      new SmsSendRequest
      {
        Purpose = SmsVerificationPurpose.ClientOtpLogin,
        PhoneNumber = normalizedPhoneNumber,
        PayloadJson = JsonSerializer.Serialize(payload),
        MessageTemplate = OtpMessageTemplate
      },
      cancellationToken);

    return new RequestClientOtpResponse
    {
      OtpSessionId = sendResponse.SessionId,
      PhoneNumber = sendResponse.PhoneNumber,
      ExpiresAtUtc = sendResponse.ExpiresAtUtc,
      ResendAvailableAtUtc = sendResponse.ResendAvailableAtUtc,
      CodeLength = sendResponse.CodeLength,
      IsNewClient = isNewClient
    };
  }

  public async Task<LoginResponse> VerifyClientOtpAsync(
    VerifyClientOtpRequest request,
    CancellationToken cancellationToken = default)
  {
    ArgumentNullException.ThrowIfNull(request);

    var verifyResult = await RequireSmsService().VerifySmsAsync(
      new SmsVerifyRequest
      {
        SessionId = request.OtpSessionId,
        Code = request.Code
      },
      cancellationToken);

    if (!verifyResult.IsSuccess)
      throw CreateOtpVerificationException(verifyResult.FailureReason);

    if (verifyResult.Purpose != SmsVerificationPurpose.ClientOtpLogin)
      throw new ClientErrorException(
        errorCode: "sms_session_purpose_mismatch",
        detail: "Эта сессия не предназначена для входа клиента.",
        reason: "purpose_mismatch");

    var payload = DeserializeOtpPayload(verifyResult.PayloadJson);

    var client = await _dbContext.Clients
      .AsTracking()
      .FirstOrDefaultAsync(x => x.PhoneNumber == payload.PhoneNumber, cancellationToken);

    if (client is null)
    {
      var trimmedName = string.IsNullOrWhiteSpace(request.Name) ? string.Empty : request.Name.Trim();
      client = new Client(trimmedName, payload.PhoneNumber);
      _dbContext.Clients.Add(client);
      await _dbContext.SaveChangesAsync(cancellationToken);
    }
    else if (!string.IsNullOrWhiteSpace(request.Name) && string.IsNullOrWhiteSpace(client.Name))
    {
      client.SetName(request.Name.Trim());
      await _dbContext.SaveChangesAsync(cancellationToken);
    }

    var token = _jwtTokenProvider.GenerateToken(
      client.Id, client.Name, client.PhoneNumber, client.Role);

    return new LoginResponse
    {
      UserId = client.Id,
      Name = client.Name,
      PhoneNumber = client.PhoneNumber,
      Role = client.Role,
      AccessToken = token.AccessToken,
      ExpiresAtUtc = token.ExpiresAtUtc
    };
  }

  public async Task<RequestClientOtpResponse> ResendClientOtpAsync(
    ResendClientOtpRequest request,
    CancellationToken cancellationToken = default)
  {
    ArgumentNullException.ThrowIfNull(request);

    var sendResponse = await RequireSmsService().ResendSmsAsync(
      new SmsResendRequest { SessionId = request.OtpSessionId },
      cancellationToken);

    var session = await _dbContext.SmsVerificationSessions
      .AsNoTracking()
      .FirstOrDefaultAsync(x => x.Id == request.OtpSessionId, cancellationToken);

    var isNewClient = false;
    if (session is not null && !string.IsNullOrEmpty(session.PayloadJson))
    {
      try
      {
        var payload = JsonSerializer.Deserialize<ClientOtpLoginPayload>(session.PayloadJson);
        if (payload is not null) isNewClient = payload.IsNewClient;
      }
      catch (JsonException)
      {
        // ignore — payload may be malformed; default to false
      }
    }

    return new RequestClientOtpResponse
    {
      OtpSessionId = sendResponse.SessionId,
      PhoneNumber = sendResponse.PhoneNumber,
      ExpiresAtUtc = sendResponse.ExpiresAtUtc,
      ResendAvailableAtUtc = sendResponse.ResendAvailableAtUtc,
      CodeLength = sendResponse.CodeLength,
      IsNewClient = isNewClient
    };
  }

  private static ClientOtpLoginPayload DeserializeOtpPayload(string? payloadJson)
  {
    if (string.IsNullOrWhiteSpace(payloadJson))
      throw new ClientErrorException(
        errorCode: "sms_payload_missing",
        detail: "Данные сессии входа повреждены.",
        reason: "payload_missing");

    try
    {
      var payload = JsonSerializer.Deserialize<ClientOtpLoginPayload>(payloadJson);
      if (payload is null || string.IsNullOrWhiteSpace(payload.PhoneNumber))
        throw new ClientErrorException(
          errorCode: "sms_payload_invalid",
          detail: "Данные сессии входа повреждены.",
          reason: "payload_invalid");
      return payload;
    }
    catch (JsonException)
    {
      throw new ClientErrorException(
        errorCode: "sms_payload_invalid",
        detail: "Данные сессии входа повреждены.",
        reason: "payload_invalid");
    }
  }

  private static Exception CreateOtpVerificationException(SmsVerificationFailureReason reason)
  {
    return reason switch
    {
      SmsVerificationFailureReason.NotFound => new ClientErrorException(
        errorCode: "sms_session_not_found",
        detail: "Сессия входа не найдена. Запросите новый код.",
        reason: "session_not_found"),
      SmsVerificationFailureReason.InvalidCode => new ClientErrorException(
        errorCode: "sms_code_invalid",
        detail: "Код подтверждения введен неверно.",
        reason: "invalid_code"),
      SmsVerificationFailureReason.Expired => new ClientErrorException(
        errorCode: "sms_code_expired",
        detail: "Срок действия кода истек. Запросите новый код.",
        reason: "expired"),
      SmsVerificationFailureReason.AttemptsExceeded => new ClientErrorException(
        errorCode: "sms_attempts_exceeded",
        detail: "Лимит попыток ввода кода исчерпан. Запросите новый код.",
        reason: "attempts_exceeded"),
      SmsVerificationFailureReason.AlreadyCompleted => new ClientErrorException(
        errorCode: "sms_session_already_completed",
        detail: "Эта сессия входа уже завершена. Запросите новый код.",
        reason: "already_completed"),
      _ => new ClientErrorException(
        errorCode: "sms_verification_failed",
        detail: "Подтверждение номера не удалось.",
        reason: "verification_failed")
    };
  }

  private sealed class ClientOtpLoginPayload
  {
    public string PhoneNumber { get; init; } = string.Empty;
    public bool IsNewClient { get; init; }
  }

}
