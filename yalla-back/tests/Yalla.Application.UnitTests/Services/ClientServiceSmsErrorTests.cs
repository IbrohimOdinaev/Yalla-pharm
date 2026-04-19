using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Yalla.Application.Common;
using Yalla.Application.DTO.Request;
using Yalla.Application.Services;
using Yalla.Application.UnitTests.TestInfrastructure;
using Yalla.Domain.Enums;
using Yalla.Domain.Exceptions;

namespace Yalla.Application.UnitTests.Services;

public sealed class ClientServiceSmsErrorTests
{
  [Fact]
  public async Task RegisterClientAsync_WhenPhoneVerificationRequired_ShouldThrowClientError()
  {
    using var scope = TestDbFactory.Create();
    var service = CreateService(
      scope,
      smsOptions: new SmsVerificationOptions
      {
        RegistrationEnabled = true,
        AllowRegistrationBypass = false
      });

    var exception = await Assert.ThrowsAsync<ClientErrorException>(() => service.RegisterClientAsync(new RegisterClientRequest
    {
      Name = "Client One",
      PhoneNumber = "900123111",
      Password = "Pass123!",
      SkipPhoneVerification = false
    }));

    Assert.Equal("phone_verification_required", exception.ErrorCode);
    Assert.Equal("phone_verification_required", exception.Reason);
  }

  [Fact]
  public async Task RegisterClientAsync_WhenBypassDisabled_ShouldThrowClientError()
  {
    using var scope = TestDbFactory.Create();
    var service = CreateService(
      scope,
      smsOptions: new SmsVerificationOptions
      {
        RegistrationEnabled = true,
        AllowRegistrationBypass = false
      });

    var exception = await Assert.ThrowsAsync<ClientErrorException>(() => service.RegisterClientAsync(new RegisterClientRequest
    {
      Name = "Client Two",
      PhoneNumber = "900123112",
      Password = "Pass123!",
      SkipPhoneVerification = true
    }));

    Assert.Equal("phone_verification_bypass_disabled", exception.ErrorCode);
    Assert.Equal("bypass_disabled", exception.Reason);
  }

  [Fact]
  public async Task VerifyClientRegistrationAsync_WhenInvalidCodeFromSmsService_ShouldThrowClientError()
  {
    using var scope = TestDbFactory.Create();
    var fakeSmsService = new FakeSmsService
    {
      VerifyResponse = new SmsVerifyResponse
      {
        IsSuccess = false,
        FailureReason = SmsVerificationFailureReason.InvalidCode
      }
    };
    var service = CreateService(
      scope,
      smsService: fakeSmsService,
      smsOptions: new SmsVerificationOptions
      {
        RegistrationEnabled = true,
        AllowRegistrationBypass = false
      });

    var exception = await Assert.ThrowsAsync<ClientErrorException>(() => service.VerifyClientRegistrationAsync(
      new VerifyClientRegistrationRequest
      {
        RegistrationId = Guid.NewGuid(),
        Code = "000000"
      }));

    Assert.Equal("sms_code_invalid", exception.ErrorCode);
    Assert.Equal("invalid_code", exception.Reason);
  }

  private static ClientService CreateService(
    TestDbScope scope,
    ISmsService? smsService = null,
    SmsVerificationOptions? smsOptions = null)
  {
    var logger = LoggerFactory.Create(_ => { }).CreateLogger<ClientService>();
    return new ClientService(
      scope.Db,
      new StubPaymentService(
        Options.Create(new DushanbeCityPaymentOptions()),
        new FakePaymentSettingsService()),
      new BCryptPasswordHasher(),
      smsService ?? new FakeSmsService(),
      Options.Create(smsOptions ?? new SmsVerificationOptions()),
      Options.Create(new DushanbeCityPaymentOptions()),
      logger,
      new NoOpRealtimeUpdatesPublisher(),
      new FakeClientAddressService());
  }

  private sealed class FakeSmsService : ISmsService
  {
    public SmsSendResponse SendResponse { get; set; } = new()
    {
      SessionId = Guid.NewGuid(),
      PhoneNumber = "900000000",
      ExpiresAtUtc = DateTime.UtcNow.AddMinutes(10),
      ResendAvailableAtUtc = DateTime.UtcNow.AddMinutes(1),
      CodeLength = 6,
      AttemptsRemaining = 5,
      ResendsRemaining = 5
    };

    public SmsVerifyResponse VerifyResponse { get; set; } = new()
    {
      IsSuccess = true,
      FailureReason = SmsVerificationFailureReason.None,
      SessionId = Guid.NewGuid(),
      Purpose = SmsVerificationPurpose.ClientRegistration,
      PhoneNumber = "900000000",
      PayloadJson = """{"name":"Client","phoneNumber":"900000000","passwordHash":"hash"}""",
      AttemptsRemaining = 5
    };

    public Task<SmsSendResponse> SendSmsAsync(SmsSendRequest request, CancellationToken cancellationToken = default)
      => Task.FromResult(SendResponse);

    public Task<SmsSendResponse> ResendSmsAsync(SmsResendRequest request, CancellationToken cancellationToken = default)
      => Task.FromResult(SendResponse);

    public Task<SmsVerifyResponse> VerifySmsAsync(SmsVerifyRequest request, CancellationToken cancellationToken = default)
      => Task.FromResult(VerifyResponse);
  }
}
