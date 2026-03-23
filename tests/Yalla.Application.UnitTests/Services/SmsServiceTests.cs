using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Yalla.Application.Abstractions;
using Yalla.Application.Common;
using Yalla.Application.Services;
using Yalla.Application.UnitTests.TestInfrastructure;
using Yalla.Domain.Entities;
using Yalla.Domain.Enums;
using Yalla.Domain.Exceptions;

namespace Yalla.Application.UnitTests.Services;

public sealed class SmsServiceTests
{
  [Fact]
  public async Task SendSmsAsync_ShouldCreatePendingSessionAndReturnMetadata()
  {
    using var scope = TestDbFactory.Create();
    var sender = new FakeSmsSender();
    var service = CreateService(scope, sender);

    var response = await service.SendSmsAsync(new SmsSendRequest
    {
      Purpose = SmsVerificationPurpose.ClientRegistration,
      PhoneNumber = "+992900111222",
      PayloadJson = """{"name":"User"}"""
    });

    Assert.Equal("900111222", response.PhoneNumber);
    Assert.Equal(6, response.CodeLength);
    Assert.Equal(5, response.AttemptsRemaining);
    Assert.Equal(5, response.ResendsRemaining);
    Assert.Single(sender.SendCommands);
    Assert.Contains("111111", sender.SendCommands[0].Message, StringComparison.Ordinal);

    var session = await scope.Db.SmsVerificationSessions
      .AsNoTracking()
      .FirstAsync(x => x.Id == response.SessionId);

    Assert.Equal(SmsVerificationStatus.Pending, session.Status);
    Assert.Equal("900111222", session.PhoneNumber);
    Assert.Equal(SmsVerificationPurpose.ClientRegistration, session.Purpose);
    Assert.Equal("provider-msg-1", session.LastMsgId);
    Assert.Equal("provider-txn-1", session.LastTxnId);
  }

  [Fact]
  public async Task SendSmsAsync_WhenProviderFails_ShouldThrowClientError()
  {
    using var scope = TestDbFactory.Create();
    var sender = new FakeSmsSender();
    sender.SendResults.Enqueue(new SmsSendResult
    {
      IsSuccess = false,
      StatusCode = 500,
      ErrorCode = "provider_down"
    });

    var service = CreateService(scope, sender);

    var exception = await Assert.ThrowsAsync<ClientErrorException>(() => service.SendSmsAsync(new SmsSendRequest
    {
      Purpose = SmsVerificationPurpose.ClientRegistration,
      PhoneNumber = "900111223"
    }));

    Assert.Equal("sms_provider_unavailable", exception.ErrorCode);
    Assert.Equal("sms_provider_error", exception.Reason);
    Assert.Equal(503, exception.StatusCode);
    Assert.Empty(scope.Db.SmsVerificationSessions);
  }

  [Fact]
  public async Task ResendSmsAsync_WhenSessionExpired_ShouldMarkSessionFailed()
  {
    using var scope = TestDbFactory.Create();
    var sender = new FakeSmsSender();
    var service = CreateService(scope, sender);

    var session = new SmsVerificationSession(
      SmsVerificationPurpose.ClientRegistration,
      "900111224",
      codeHash: "HASH",
      expiresAtUtc: DateTime.UtcNow.AddMinutes(-2),
      resendAvailableAtUtc: DateTime.UtcNow.AddMinutes(-1),
      attemptsRemaining: 5,
      resendsRemaining: 5,
      payloadJson: "{}");
    scope.Db.SmsVerificationSessions.Add(session);
    await scope.Db.SaveChangesAsync();

    var exception = await Assert.ThrowsAsync<ClientErrorException>(() => service.ResendSmsAsync(new SmsResendRequest
    {
      SessionId = session.Id
    }));

    Assert.Equal("sms_code_expired", exception.ErrorCode);
    Assert.Equal("expired", exception.Reason);
    Assert.Empty(sender.SendCommands);

    var fromDb = await scope.Db.SmsVerificationSessions.AsNoTracking().FirstAsync(x => x.Id == session.Id);
    Assert.Equal(SmsVerificationStatus.Failed, fromDb.Status);
    Assert.Equal("expired", fromDb.FailureReason);
  }

  [Fact]
  public async Task ResendSmsAsync_WhenCooldownActive_ShouldThrowCooldownError()
  {
    using var scope = TestDbFactory.Create();
    var sender = new FakeSmsSender();
    var service = CreateService(scope, sender);

    var session = new SmsVerificationSession(
      SmsVerificationPurpose.ClientRegistration,
      "900111225",
      codeHash: "HASH",
      expiresAtUtc: DateTime.UtcNow.AddMinutes(5),
      resendAvailableAtUtc: DateTime.UtcNow.AddSeconds(30),
      attemptsRemaining: 5,
      resendsRemaining: 5,
      payloadJson: "{}");
    scope.Db.SmsVerificationSessions.Add(session);
    await scope.Db.SaveChangesAsync();

    var exception = await Assert.ThrowsAsync<ClientErrorException>(() => service.ResendSmsAsync(new SmsResendRequest
    {
      SessionId = session.Id
    }));

    Assert.Equal("sms_resend_cooldown", exception.ErrorCode);
    Assert.Equal("cooldown", exception.Reason);
    Assert.Empty(sender.SendCommands);
  }

  [Fact]
  public async Task ResendSmsAsync_WhenResendLimitExceeded_ShouldMarkSessionFailed()
  {
    using var scope = TestDbFactory.Create();
    var sender = new FakeSmsSender();
    var service = CreateService(scope, sender);

    var session = new SmsVerificationSession(
      SmsVerificationPurpose.ClientRegistration,
      "900111226",
      codeHash: "HASH",
      expiresAtUtc: DateTime.UtcNow.AddMinutes(5),
      resendAvailableAtUtc: DateTime.UtcNow.AddMinutes(-1),
      attemptsRemaining: 5,
      resendsRemaining: 0,
      payloadJson: "{}");
    scope.Db.SmsVerificationSessions.Add(session);
    await scope.Db.SaveChangesAsync();

    var exception = await Assert.ThrowsAsync<ClientErrorException>(() => service.ResendSmsAsync(new SmsResendRequest
    {
      SessionId = session.Id
    }));

    Assert.Equal("sms_resend_limit_exceeded", exception.ErrorCode);
    Assert.Equal("resend_limit_exceeded", exception.Reason);
    Assert.Empty(sender.SendCommands);

    var fromDb = await scope.Db.SmsVerificationSessions.AsNoTracking().FirstAsync(x => x.Id == session.Id);
    Assert.Equal(SmsVerificationStatus.Failed, fromDb.Status);
    Assert.Equal("resend_limit_exceeded", fromDb.FailureReason);
  }

  [Fact]
  public async Task ResendSmsAsync_WhenAllowed_ShouldDecreaseResendsAndResetAttempts()
  {
    using var scope = TestDbFactory.Create();
    var sender = new FakeSmsSender();
    var service = CreateService(scope, sender, new SmsVerificationOptions
    {
      RegistrationEnabled = true,
      AllowRegistrationBypass = true,
      CodeLength = 6,
      CodeTtlMinutes = 10,
      ResendCooldownSeconds = 60,
      MaxVerificationAttempts = 5,
      MaxResendCount = 5,
      MessageTemplate = "Код: {code}",
      FixedCodeForTests = "111111"
    });

    var session = new SmsVerificationSession(
      SmsVerificationPurpose.ClientRegistration,
      "900111227",
      codeHash: "OLD_HASH",
      expiresAtUtc: DateTime.UtcNow.AddMinutes(5),
      resendAvailableAtUtc: DateTime.UtcNow.AddMinutes(-1),
      attemptsRemaining: 1,
      resendsRemaining: 2,
      payloadJson: "{}");
    scope.Db.SmsVerificationSessions.Add(session);
    await scope.Db.SaveChangesAsync();

    var response = await service.ResendSmsAsync(new SmsResendRequest
    {
      SessionId = session.Id
    });

    Assert.Equal(session.Id, response.SessionId);
    Assert.Equal(5, response.AttemptsRemaining);
    Assert.Equal(1, response.ResendsRemaining);
    Assert.Single(sender.SendCommands);

    var fromDb = await scope.Db.SmsVerificationSessions.AsNoTracking().FirstAsync(x => x.Id == session.Id);
    Assert.Equal(SmsVerificationStatus.Pending, fromDb.Status);
    Assert.Equal(5, fromDb.AttemptsRemaining);
    Assert.Equal(1, fromDb.ResendsRemaining);
    Assert.NotEqual("OLD_HASH", fromDb.CodeHash);
  }

  [Fact]
  public async Task VerifySmsAsync_WhenSessionMissing_ShouldReturnNotFoundReason()
  {
    using var scope = TestDbFactory.Create();
    var service = CreateService(scope, new FakeSmsSender());

    var response = await service.VerifySmsAsync(new SmsVerifyRequest
    {
      SessionId = Guid.NewGuid(),
      Code = "111111"
    });

    Assert.False(response.IsSuccess);
    Assert.Equal(SmsVerificationFailureReason.NotFound, response.FailureReason);
  }

  [Fact]
  public async Task VerifySmsAsync_WhenCodeMatches_ShouldMarkSessionVerified()
  {
    using var scope = TestDbFactory.Create();
    var service = CreateService(scope, new FakeSmsSender());

    var sendResponse = await service.SendSmsAsync(new SmsSendRequest
    {
      Purpose = SmsVerificationPurpose.ClientRegistration,
      PhoneNumber = "900111228",
      PayloadJson = """{"name":"User"}"""
    });

    var verifyResponse = await service.VerifySmsAsync(new SmsVerifyRequest
    {
      SessionId = sendResponse.SessionId,
      Code = "111111"
    });

    Assert.True(verifyResponse.IsSuccess);
    Assert.Equal(SmsVerificationFailureReason.None, verifyResponse.FailureReason);
    Assert.Equal("900111228", verifyResponse.PhoneNumber);
    Assert.NotNull(verifyResponse.PayloadJson);

    var session = await scope.Db.SmsVerificationSessions.AsNoTracking().FirstAsync(x => x.Id == sendResponse.SessionId);
    Assert.Equal(SmsVerificationStatus.Verified, session.Status);
    Assert.NotNull(session.VerifiedAtUtc);
  }

  [Fact]
  public async Task VerifySmsAsync_WhenInvalidCode_ShouldDecreaseAttempts()
  {
    using var scope = TestDbFactory.Create();
    var service = CreateService(scope, new FakeSmsSender());

    var sendResponse = await service.SendSmsAsync(new SmsSendRequest
    {
      Purpose = SmsVerificationPurpose.ClientRegistration,
      PhoneNumber = "900111229"
    });

    var verifyResponse = await service.VerifySmsAsync(new SmsVerifyRequest
    {
      SessionId = sendResponse.SessionId,
      Code = "000000"
    });

    Assert.False(verifyResponse.IsSuccess);
    Assert.Equal(SmsVerificationFailureReason.InvalidCode, verifyResponse.FailureReason);
    Assert.Equal(4, verifyResponse.AttemptsRemaining);

    var session = await scope.Db.SmsVerificationSessions.AsNoTracking().FirstAsync(x => x.Id == sendResponse.SessionId);
    Assert.Equal(SmsVerificationStatus.Pending, session.Status);
    Assert.Equal(4, session.AttemptsRemaining);
  }

  [Fact]
  public async Task VerifySmsAsync_WhenAttemptsExhausted_ShouldFailSession()
  {
    using var scope = TestDbFactory.Create();
    var service = CreateService(scope, new FakeSmsSender(), new SmsVerificationOptions
    {
      RegistrationEnabled = true,
      AllowRegistrationBypass = true,
      CodeLength = 6,
      CodeTtlMinutes = 10,
      ResendCooldownSeconds = 60,
      MaxVerificationAttempts = 1,
      MaxResendCount = 5,
      FixedCodeForTests = "111111"
    });

    var sendResponse = await service.SendSmsAsync(new SmsSendRequest
    {
      Purpose = SmsVerificationPurpose.ClientRegistration,
      PhoneNumber = "900111230"
    });

    var verifyResponse = await service.VerifySmsAsync(new SmsVerifyRequest
    {
      SessionId = sendResponse.SessionId,
      Code = "000000"
    });

    Assert.False(verifyResponse.IsSuccess);
    Assert.Equal(SmsVerificationFailureReason.AttemptsExceeded, verifyResponse.FailureReason);
    Assert.Equal(0, verifyResponse.AttemptsRemaining);

    var session = await scope.Db.SmsVerificationSessions.AsNoTracking().FirstAsync(x => x.Id == sendResponse.SessionId);
    Assert.Equal(SmsVerificationStatus.Failed, session.Status);
    Assert.Equal("attempts_exceeded", session.FailureReason);
  }

  [Fact]
  public async Task VerifySmsAsync_WhenSessionExpired_ShouldFailSession()
  {
    using var scope = TestDbFactory.Create();
    var service = CreateService(scope, new FakeSmsSender());

    var session = new SmsVerificationSession(
      SmsVerificationPurpose.ClientRegistration,
      "900111231",
      codeHash: "HASH",
      expiresAtUtc: DateTime.UtcNow.AddMinutes(-1),
      resendAvailableAtUtc: DateTime.UtcNow.AddMinutes(-1),
      attemptsRemaining: 5,
      resendsRemaining: 5,
      payloadJson: "{}");
    scope.Db.SmsVerificationSessions.Add(session);
    await scope.Db.SaveChangesAsync();

    var verifyResponse = await service.VerifySmsAsync(new SmsVerifyRequest
    {
      SessionId = session.Id,
      Code = "111111"
    });

    Assert.False(verifyResponse.IsSuccess);
    Assert.Equal(SmsVerificationFailureReason.Expired, verifyResponse.FailureReason);
    Assert.Equal(0, verifyResponse.AttemptsRemaining);

    var fromDb = await scope.Db.SmsVerificationSessions.AsNoTracking().FirstAsync(x => x.Id == session.Id);
    Assert.Equal(SmsVerificationStatus.Failed, fromDb.Status);
    Assert.Equal("expired", fromDb.FailureReason);
  }

  [Fact]
  public async Task VerifySmsAsync_WhenSessionAlreadyCompleted_ShouldReturnAlreadyCompleted()
  {
    using var scope = TestDbFactory.Create();
    var service = CreateService(scope, new FakeSmsSender());

    var session = new SmsVerificationSession(
      SmsVerificationPurpose.ClientRegistration,
      "900111232",
      codeHash: "HASH",
      expiresAtUtc: DateTime.UtcNow.AddMinutes(5),
      resendAvailableAtUtc: DateTime.UtcNow.AddMinutes(-1),
      attemptsRemaining: 5,
      resendsRemaining: 5,
      payloadJson: "{}");
    session.MarkVerified(DateTime.UtcNow);
    scope.Db.SmsVerificationSessions.Add(session);
    await scope.Db.SaveChangesAsync();

    var verifyResponse = await service.VerifySmsAsync(new SmsVerifyRequest
    {
      SessionId = session.Id,
      Code = "111111"
    });

    Assert.False(verifyResponse.IsSuccess);
    Assert.Equal(SmsVerificationFailureReason.AlreadyCompleted, verifyResponse.FailureReason);
    Assert.Equal("900111232", verifyResponse.PhoneNumber);
  }

  [Fact]
  public async Task SendSmsAsync_WhenOptionsInvalid_ShouldThrowInvalidOperation()
  {
    using var scope = TestDbFactory.Create();
    var service = CreateService(scope, new FakeSmsSender(), new SmsVerificationOptions
    {
      RegistrationEnabled = true,
      AllowRegistrationBypass = true,
      CodeLength = 9,
      CodeTtlMinutes = 10,
      ResendCooldownSeconds = 60,
      MaxVerificationAttempts = 5,
      MaxResendCount = 5
    });

    await Assert.ThrowsAsync<InvalidOperationException>(() => service.SendSmsAsync(new SmsSendRequest
    {
      Purpose = SmsVerificationPurpose.ClientRegistration,
      PhoneNumber = "900111233"
    }));
  }

  private static SmsService CreateService(
    TestDbScope scope,
    ISmsSender sender,
    SmsVerificationOptions? options = null)
  {
    var logger = LoggerFactory.Create(_ => { }).CreateLogger<SmsService>();
    return new SmsService(
      scope.Db,
      sender,
      Options.Create(options ?? new SmsVerificationOptions
      {
        RegistrationEnabled = true,
        AllowRegistrationBypass = true,
        CodeLength = 6,
        CodeTtlMinutes = 10,
        ResendCooldownSeconds = 60,
        MaxVerificationAttempts = 5,
        MaxResendCount = 5,
        MessageTemplate = "Код подтверждения: {code}",
        FixedCodeForTests = "111111"
      }),
      logger);
  }

  private sealed class FakeSmsSender : ISmsSender
  {
    private int _counter;

    public Queue<SmsSendResult> SendResults { get; } = new();
    public List<SmsSendCommand> SendCommands { get; } = [];

    public Task<SmsSendResult> SendSmsAsync(
      SmsSendCommand command,
      CancellationToken cancellationToken = default)
    {
      SendCommands.Add(command);

      if (SendResults.Count > 0)
        return Task.FromResult(SendResults.Dequeue());

      _counter++;
      return Task.FromResult(new SmsSendResult
      {
        IsSuccess = true,
        StatusCode = 201,
        TxnId = $"provider-txn-{_counter}",
        MsgId = $"provider-msg-{_counter}"
      });
    }

    public Task<SmsDeliveryVerificationResult> VerifySmsAsync(
      SmsDeliveryVerificationCommand command,
      CancellationToken cancellationToken = default)
    {
      return Task.FromResult(new SmsDeliveryVerificationResult
      {
        IsSuccess = true,
        StatusCode = 200,
        DeliveryStatus = "DELIVERED"
      });
    }
  }
}
