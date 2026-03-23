using System.Security.Cryptography;
using System.Text;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Yalla.Application.Abstractions;
using Yalla.Application.Common;
using Yalla.Domain.Entities;
using Yalla.Domain.Enums;
using Yalla.Domain.Exceptions;

namespace Yalla.Application.Services;

public sealed class SmsService : ISmsService
{
  private readonly IAppDbContext _dbContext;
  private readonly ISmsSender _smsSender;
  private readonly SmsVerificationOptions _options;
  private readonly ILogger<SmsService> _logger;

  public SmsService(
    IAppDbContext dbContext,
    ISmsSender smsSender,
    IOptions<SmsVerificationOptions> options,
    ILogger<SmsService> logger)
  {
    ArgumentNullException.ThrowIfNull(dbContext);
    ArgumentNullException.ThrowIfNull(smsSender);
    ArgumentNullException.ThrowIfNull(options);
    ArgumentNullException.ThrowIfNull(logger);

    _dbContext = dbContext;
    _smsSender = smsSender;
    _options = options.Value;
    _logger = logger;
  }

  public async Task<SmsSendResponse> SendSmsAsync(
    SmsSendRequest request,
    CancellationToken cancellationToken = default)
  {
    ArgumentNullException.ThrowIfNull(request);

    var normalizedPhoneNumber = UserInputPolicy.NormalizePhoneNumber(request.PhoneNumber);
    var effectiveOptions = GetValidatedOptions();
    var code = GenerateCode(effectiveOptions);
    var nowUtc = DateTime.UtcNow;
    var expiresAtUtc = nowUtc.AddMinutes(effectiveOptions.CodeTtlMinutes);
    var resendAvailableAtUtc = nowUtc.AddSeconds(effectiveOptions.ResendCooldownSeconds);
    var txnId = Guid.NewGuid().ToString("N");

    _logger.LogInformation(
      "Creating SMS verification session. Purpose={Purpose}, Phone={PhoneNumber}",
      request.Purpose,
      normalizedPhoneNumber);

    var providerResult = await _smsSender.SendSmsAsync(
      new SmsSendCommand
      {
        PhoneNumber = normalizedPhoneNumber,
        Message = BuildSmsMessage(request.MessageTemplate, effectiveOptions.MessageTemplate, code),
        TxnId = txnId,
        IsConfidential = true
      },
      cancellationToken);

    if (!providerResult.IsSuccess)
    {
      _logger.LogWarning(
        "SMS provider send failed. Phone={PhoneNumber}, Purpose={Purpose}, ProviderStatus={ProviderStatus}, ProviderCode={ProviderCode}",
        normalizedPhoneNumber,
        request.Purpose,
        providerResult.StatusCode,
        providerResult.ErrorCode);
      throw new ClientErrorException(
        errorCode: "sms_provider_unavailable",
        detail: "Не удалось отправить SMS. Повторите попытку позже.",
        reason: "sms_provider_error",
        statusCode: 503);
    }

    var session = new SmsVerificationSession(
      request.Purpose,
      normalizedPhoneNumber,
      HashCode(code),
      expiresAtUtc,
      resendAvailableAtUtc,
      effectiveOptions.MaxVerificationAttempts,
      effectiveOptions.MaxResendCount,
      request.PayloadJson);

    session.RegisterDelivery(providerResult.TxnId ?? txnId, providerResult.MsgId);
    _dbContext.SmsVerificationSessions.Add(session);
    await _dbContext.SaveChangesAsync(cancellationToken);

    _logger.LogInformation(
      "SMS verification session created. SessionId={SessionId}, Purpose={Purpose}, Phone={PhoneNumber}, ExpiresAtUtc={ExpiresAtUtc}",
      session.Id,
      session.Purpose,
      session.PhoneNumber,
      session.ExpiresAtUtc);

    return new SmsSendResponse
    {
      SessionId = session.Id,
      PhoneNumber = session.PhoneNumber,
      ExpiresAtUtc = session.ExpiresAtUtc,
      ResendAvailableAtUtc = session.ResendAvailableAtUtc,
      CodeLength = effectiveOptions.CodeLength,
      AttemptsRemaining = session.AttemptsRemaining,
      ResendsRemaining = session.ResendsRemaining
    };
  }

  public async Task<SmsSendResponse> ResendSmsAsync(
    SmsResendRequest request,
    CancellationToken cancellationToken = default)
  {
    ArgumentNullException.ThrowIfNull(request);

    if (request.SessionId == Guid.Empty)
      throw new DomainArgumentException("SessionId can't be empty.");

    var session = await _dbContext.SmsVerificationSessions
      .AsTracking()
      .FirstOrDefaultAsync(x => x.Id == request.SessionId, cancellationToken)
      ?? throw new ClientErrorException(
        errorCode: "sms_session_not_found",
        detail: "Сессия подтверждения не найдена. Запросите новый код.",
        reason: "session_not_found");

    if (session.Status != SmsVerificationStatus.Pending)
      throw new ClientErrorException(
        errorCode: "sms_session_already_completed",
        detail: "Сессия подтверждения уже завершена. Запросите новый код.",
        reason: "already_completed");

    var nowUtc = DateTime.UtcNow;
    if (session.ExpiresAtUtc <= nowUtc)
    {
      session.MarkFailed("expired");
      await _dbContext.SaveChangesAsync(cancellationToken);
      _logger.LogInformation(
        "SMS resend rejected because session expired. SessionId={SessionId}, Phone={PhoneNumber}",
        session.Id,
        session.PhoneNumber);
      throw new ClientErrorException(
        errorCode: "sms_code_expired",
        detail: "Код подтверждения истек. Запросите новый код.",
        reason: "expired");
    }

    if (session.ResendAvailableAtUtc > nowUtc)
    {
      var secondsLeft = Math.Max(1, (int)Math.Ceiling((session.ResendAvailableAtUtc - nowUtc).TotalSeconds));
      throw new ClientErrorException(
        errorCode: "sms_resend_cooldown",
        detail: $"Повторная отправка будет доступна через {secondsLeft} сек.",
        reason: "cooldown");
    }

    if (session.ResendsRemaining <= 0)
    {
      session.MarkFailed("resend_limit_exceeded");
      await _dbContext.SaveChangesAsync(cancellationToken);
      _logger.LogInformation(
        "SMS resend rejected because resend limit exceeded. SessionId={SessionId}, Phone={PhoneNumber}",
        session.Id,
        session.PhoneNumber);
      throw new ClientErrorException(
        errorCode: "sms_resend_limit_exceeded",
        detail: "Лимит повторной отправки исчерпан. Начните регистрацию заново.",
        reason: "resend_limit_exceeded");
    }

    var effectiveOptions = GetValidatedOptions();
    var code = GenerateCode(effectiveOptions);
    var expiresAtUtc = nowUtc.AddMinutes(effectiveOptions.CodeTtlMinutes);
    var resendAvailableAtUtc = nowUtc.AddSeconds(effectiveOptions.ResendCooldownSeconds);
    var txnId = Guid.NewGuid().ToString("N");

    var providerResult = await _smsSender.SendSmsAsync(
      new SmsSendCommand
      {
        PhoneNumber = session.PhoneNumber,
        Message = BuildSmsMessage(
          customTemplate: null,
          defaultTemplate: effectiveOptions.MessageTemplate,
          code: code),
        TxnId = txnId,
        IsConfidential = true
      },
      cancellationToken);

    if (!providerResult.IsSuccess)
    {
      _logger.LogWarning(
        "SMS provider resend failed. SessionId={SessionId}, Phone={PhoneNumber}, ProviderStatus={ProviderStatus}, ProviderCode={ProviderCode}",
        session.Id,
        session.PhoneNumber,
        providerResult.StatusCode,
        providerResult.ErrorCode);
      throw new ClientErrorException(
        errorCode: "sms_provider_unavailable",
        detail: "Не удалось отправить SMS повторно. Повторите попытку позже.",
        reason: "sms_provider_error",
        statusCode: 503);
    }

    session.UseResend();
    session.SetCode(
      HashCode(code),
      expiresAtUtc,
      resendAvailableAtUtc,
      effectiveOptions.MaxVerificationAttempts);
    session.RegisterDelivery(providerResult.TxnId ?? txnId, providerResult.MsgId);
    await _dbContext.SaveChangesAsync(cancellationToken);

    _logger.LogInformation(
      "SMS code resent. SessionId={SessionId}, Phone={PhoneNumber}, ResendsRemaining={ResendsRemaining}",
      session.Id,
      session.PhoneNumber,
      session.ResendsRemaining);

    return new SmsSendResponse
    {
      SessionId = session.Id,
      PhoneNumber = session.PhoneNumber,
      ExpiresAtUtc = session.ExpiresAtUtc,
      ResendAvailableAtUtc = session.ResendAvailableAtUtc,
      CodeLength = effectiveOptions.CodeLength,
      AttemptsRemaining = session.AttemptsRemaining,
      ResendsRemaining = session.ResendsRemaining
    };
  }

  public async Task<SmsVerifyResponse> VerifySmsAsync(
    SmsVerifyRequest request,
    CancellationToken cancellationToken = default)
  {
    ArgumentNullException.ThrowIfNull(request);

    if (request.SessionId == Guid.Empty)
      throw new DomainArgumentException("SessionId can't be empty.");

    var session = await _dbContext.SmsVerificationSessions
      .AsTracking()
      .FirstOrDefaultAsync(x => x.Id == request.SessionId, cancellationToken);

    if (session is null)
    {
      _logger.LogInformation(
        "SMS verification failed: session not found. SessionId={SessionId}",
        request.SessionId);
      return new SmsVerifyResponse
      {
        FailureReason = SmsVerificationFailureReason.NotFound
      };
    }

    if (session.Status != SmsVerificationStatus.Pending)
    {
      _logger.LogInformation(
        "SMS verification failed: session already completed. SessionId={SessionId}, Status={Status}",
        session.Id,
        session.Status);
      return new SmsVerifyResponse
      {
        SessionId = session.Id,
        Purpose = session.Purpose,
        PhoneNumber = session.PhoneNumber,
        AttemptsRemaining = session.AttemptsRemaining,
        ExpiresAtUtc = session.ExpiresAtUtc,
        FailureReason = SmsVerificationFailureReason.AlreadyCompleted
      };
    }

    var nowUtc = DateTime.UtcNow;
    if (session.ExpiresAtUtc <= nowUtc)
    {
      session.MarkFailed("expired");
      await _dbContext.SaveChangesAsync(cancellationToken);
      _logger.LogInformation(
        "SMS verification failed: code expired. SessionId={SessionId}, Phone={PhoneNumber}",
        session.Id,
        session.PhoneNumber);
      return new SmsVerifyResponse
      {
        SessionId = session.Id,
        Purpose = session.Purpose,
        PhoneNumber = session.PhoneNumber,
        AttemptsRemaining = 0,
        ExpiresAtUtc = session.ExpiresAtUtc,
        FailureReason = SmsVerificationFailureReason.Expired
      };
    }

    var effectiveOptions = GetValidatedOptions();
    var normalizedCode = NormalizeCode(request.Code, effectiveOptions.CodeLength);
    var inputHash = HashCode(normalizedCode);
    if (string.Equals(session.CodeHash, inputHash, StringComparison.Ordinal))
    {
      session.MarkVerified(nowUtc);
      await _dbContext.SaveChangesAsync(cancellationToken);
      _logger.LogInformation(
        "SMS verification succeeded. SessionId={SessionId}, Purpose={Purpose}, Phone={PhoneNumber}",
        session.Id,
        session.Purpose,
        session.PhoneNumber);

      return new SmsVerifyResponse
      {
        IsSuccess = true,
        FailureReason = SmsVerificationFailureReason.None,
        SessionId = session.Id,
        Purpose = session.Purpose,
        PhoneNumber = session.PhoneNumber,
        PayloadJson = session.PayloadJson,
        AttemptsRemaining = session.AttemptsRemaining,
        ExpiresAtUtc = session.ExpiresAtUtc
      };
    }

    session.ConsumeAttempt();
    if (session.AttemptsRemaining <= 0)
    {
      session.MarkFailed("attempts_exceeded");
      await _dbContext.SaveChangesAsync(cancellationToken);
      _logger.LogInformation(
        "SMS verification failed: attempts exceeded. SessionId={SessionId}, Phone={PhoneNumber}",
        session.Id,
        session.PhoneNumber);
      return new SmsVerifyResponse
      {
        SessionId = session.Id,
        Purpose = session.Purpose,
        PhoneNumber = session.PhoneNumber,
        AttemptsRemaining = 0,
        ExpiresAtUtc = session.ExpiresAtUtc,
        FailureReason = SmsVerificationFailureReason.AttemptsExceeded
      };
    }

    await _dbContext.SaveChangesAsync(cancellationToken);
    _logger.LogInformation(
      "SMS verification failed: invalid code. SessionId={SessionId}, Phone={PhoneNumber}, AttemptsRemaining={AttemptsRemaining}",
      session.Id,
      session.PhoneNumber,
      session.AttemptsRemaining);
    return new SmsVerifyResponse
    {
      SessionId = session.Id,
      Purpose = session.Purpose,
      PhoneNumber = session.PhoneNumber,
      AttemptsRemaining = session.AttemptsRemaining,
      ExpiresAtUtc = session.ExpiresAtUtc,
      FailureReason = SmsVerificationFailureReason.InvalidCode
    };
  }

  private SmsVerificationOptions GetValidatedOptions()
  {
    var codeLength = _options.CodeLength;
    if (codeLength < 4 || codeLength > 8)
      throw new InvalidOperationException("SmsVerification:CodeLength must be between 4 and 8.");

    if (_options.CodeTtlMinutes <= 0)
      throw new InvalidOperationException("SmsVerification:CodeTtlMinutes must be greater than zero.");

    if (_options.ResendCooldownSeconds <= 0)
      throw new InvalidOperationException("SmsVerification:ResendCooldownSeconds must be greater than zero.");

    if (_options.MaxVerificationAttempts <= 0)
      throw new InvalidOperationException("SmsVerification:MaxVerificationAttempts must be greater than zero.");

    if (_options.MaxResendCount < 0)
      throw new InvalidOperationException("SmsVerification:MaxResendCount can't be negative.");

    return _options;
  }

  private string GenerateCode(SmsVerificationOptions options)
  {
    var fixedCode = options.FixedCodeForTests?.Trim() ?? string.Empty;
    if (!string.IsNullOrWhiteSpace(fixedCode))
    {
      var normalizedFixedCode = NormalizeCode(fixedCode, options.CodeLength);
      _logger.LogInformation("Using fixed SMS verification code for current environment.");
      return normalizedFixedCode;
    }

    var lowerBound = (int)Math.Pow(10, options.CodeLength - 1);
    var upperBound = (int)Math.Pow(10, options.CodeLength);
    return RandomNumberGenerator.GetInt32(lowerBound, upperBound).ToString();
  }

  private static string BuildSmsMessage(string? customTemplate, string defaultTemplate, string code)
  {
    var template = string.IsNullOrWhiteSpace(customTemplate) ? defaultTemplate : customTemplate;
    if (string.IsNullOrWhiteSpace(template))
      template = "Код подтверждения: {code}";

    return template.Replace("{code}", code, StringComparison.Ordinal);
  }

  private static string NormalizeCode(string? code, int requiredLength)
  {
    if (string.IsNullOrWhiteSpace(code))
      throw new DomainArgumentException("Sms code can't be null or whitespace.");

    var trimmed = code.Trim();
    if (trimmed.Length != requiredLength || !trimmed.All(char.IsDigit))
      throw new DomainArgumentException($"Sms code must contain exactly {requiredLength} digits.");

    return trimmed;
  }

  private static string HashCode(string code)
  {
    var bytes = SHA256.HashData(Encoding.UTF8.GetBytes(code));
    return Convert.ToHexString(bytes);
  }
}
