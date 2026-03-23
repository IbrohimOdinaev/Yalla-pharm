using System.Net;
using System.Net.Http.Json;
using System.Threading;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Yalla.Api.IntegrationTests.TestInfrastructure;
using Yalla.Domain.Enums;
using Yalla.Infrastructure;

namespace Yalla.Api.IntegrationTests;

public sealed class ClientRegistrationSmsIntegrationTests : ApiTestBase
{
  private static long _phoneCounter = DateTime.UtcNow.Ticks % 10_000_000;

  public ClientRegistrationSmsIntegrationTests(ApiWebApplicationFactory factory)
    : base(factory)
  {
  }

  [Fact]
  public async Task RegisterRequest_ThenVerify_WithFixedCode_ShouldCreateClientAndAllowLogin()
  {
    using var client = CreateClient();
    var phone = NextPhoneNumber();
    const string password = "Pass123!";

    var requestResponse = await client.PostAsJsonAsync("/api/clients/register/request", new
    {
      Name = "Sms Flow User",
      PhoneNumber = phone,
      Password = password
    });

    Assert.Equal(HttpStatusCode.OK, requestResponse.StatusCode);
    var requestPayload = await ReadJsonAsync(requestResponse);
    var registrationId = requestPayload.GetProperty("registrationId").GetGuid();
    Assert.NotEqual(Guid.Empty, registrationId);
    Assert.Equal(6, requestPayload.GetProperty("codeLength").GetInt32());

    var verifyResponse = await client.PostAsJsonAsync("/api/clients/register/verify", new
    {
      RegistrationId = registrationId,
      Code = "111111"
    });

    Assert.Equal(HttpStatusCode.OK, verifyResponse.StatusCode);
    var verifyPayload = await ReadJsonAsync(verifyResponse);
    Assert.Equal(phone, verifyPayload.GetProperty("client").GetProperty("phoneNumber").GetString());

    using var scope = Factory.CreateScope();
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();

    var session = await db.SmsVerificationSessions
      .AsNoTracking()
      .FirstOrDefaultAsync(x => x.Id == registrationId);
    Assert.NotNull(session);
    Assert.Equal(SmsVerificationStatus.Verified, session!.Status);

    var loginResponse = await client.PostAsJsonAsync("/api/auth/login", new
    {
      PhoneNumber = phone,
      Password = password
    });

    Assert.Equal(HttpStatusCode.OK, loginResponse.StatusCode);
    var loginPayload = await ReadJsonAsync(loginResponse);
    Assert.False(string.IsNullOrWhiteSpace(loginPayload.GetProperty("accessToken").GetString()));
  }

  [Fact]
  public async Task Register_DirectWithoutSkip_WhenSmsRequired_ShouldReturnBadRequest()
  {
    using var client = CreateClient();

    var response = await client.PostAsJsonAsync("/api/clients/register", new
    {
      Name = "Direct Register User",
      PhoneNumber = NextPhoneNumber(),
      Password = "Pass123!"
    });

    Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    var payload = await ReadJsonAsync(response);
    Assert.Equal("phone_verification_required", payload.GetProperty("errorCode").GetString());
    Assert.Equal("phone_verification_required", payload.GetProperty("reason").GetString());
  }

  [Fact]
  public async Task Register_DirectWithSkip_InTestMode_ShouldSucceed()
  {
    using var client = CreateClient();
    var phone = NextPhoneNumber();

    var response = await client.PostAsJsonAsync("/api/clients/register", new
    {
      Name = "Bypass User",
      PhoneNumber = phone,
      Password = "Pass123!",
      SkipPhoneVerification = true
    });

    Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    var payload = await ReadJsonAsync(response);
    Assert.Equal(phone, payload.GetProperty("client").GetProperty("phoneNumber").GetString());
  }

  [Fact]
  public async Task RegisterVerify_WithInvalidCode_ShouldFailAndDecreaseAttempts()
  {
    using var client = CreateClient();
    var phone = NextPhoneNumber();

    var requestResponse = await client.PostAsJsonAsync("/api/clients/register/request", new
    {
      Name = "Wrong Code User",
      PhoneNumber = phone,
      Password = "Pass123!"
    });

    Assert.Equal(HttpStatusCode.OK, requestResponse.StatusCode);
    var requestPayload = await ReadJsonAsync(requestResponse);
    var registrationId = requestPayload.GetProperty("registrationId").GetGuid();

    var verifyResponse = await client.PostAsJsonAsync("/api/clients/register/verify", new
    {
      RegistrationId = registrationId,
      Code = "000000"
    });

    Assert.Equal(HttpStatusCode.BadRequest, verifyResponse.StatusCode);
    var verifyPayload = await ReadJsonAsync(verifyResponse);
    Assert.Equal("sms_code_invalid", verifyPayload.GetProperty("errorCode").GetString());
    Assert.Equal("invalid_code", verifyPayload.GetProperty("reason").GetString());

    using var scope = Factory.CreateScope();
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    var session = await db.SmsVerificationSessions
      .AsNoTracking()
      .FirstAsync(x => x.Id == registrationId);

    Assert.Equal(SmsVerificationStatus.Pending, session.Status);
    Assert.Equal(4, session.AttemptsRemaining);
  }

  [Fact]
  public async Task RegisterResend_BeforeCooldown_ShouldReturnBadRequest()
  {
    using var client = CreateClient();

    var requestResponse = await client.PostAsJsonAsync("/api/clients/register/request", new
    {
      Name = "Resend Cooldown User",
      PhoneNumber = NextPhoneNumber(),
      Password = "Pass123!"
    });

    Assert.Equal(HttpStatusCode.OK, requestResponse.StatusCode);
    var requestPayload = await ReadJsonAsync(requestResponse);
    var registrationId = requestPayload.GetProperty("registrationId").GetGuid();

    var resendResponse = await client.PostAsJsonAsync("/api/clients/register/resend", new
    {
      RegistrationId = registrationId
    });

    Assert.Equal(HttpStatusCode.BadRequest, resendResponse.StatusCode);
    var resendPayload = await ReadJsonAsync(resendResponse);
    Assert.Equal("sms_resend_cooldown", resendPayload.GetProperty("errorCode").GetString());
    Assert.Equal("cooldown", resendPayload.GetProperty("reason").GetString());
  }

  [Fact]
  public async Task RegisterResend_AfterCooldown_ShouldSucceedAndDecreaseResendCounter()
  {
    using var client = CreateClient();

    var requestResponse = await client.PostAsJsonAsync("/api/clients/register/request", new
    {
      Name = "Resend Success User",
      PhoneNumber = NextPhoneNumber(),
      Password = "Pass123!"
    });

    Assert.Equal(HttpStatusCode.OK, requestResponse.StatusCode);
    var requestPayload = await ReadJsonAsync(requestResponse);
    var registrationId = requestPayload.GetProperty("registrationId").GetGuid();

    using (var scope = Factory.CreateScope())
    {
      var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
      _ = await db.Database.ExecuteSqlInterpolatedAsync(
        $"UPDATE sms_verification_sessions SET resend_available_at_utc = {DateTime.UtcNow.AddMinutes(-1)} WHERE id = {registrationId}");
    }

    var resendResponse = await client.PostAsJsonAsync("/api/clients/register/resend", new
    {
      RegistrationId = registrationId
    });

    Assert.Equal(HttpStatusCode.OK, resendResponse.StatusCode);
    var resendPayload = await ReadJsonAsync(resendResponse);
    Assert.Equal(registrationId, resendPayload.GetProperty("registrationId").GetGuid());
    Assert.Equal(6, resendPayload.GetProperty("codeLength").GetInt32());

    using var verifyScope = Factory.CreateScope();
    var verifyDb = verifyScope.ServiceProvider.GetRequiredService<AppDbContext>();
    var session = await verifyDb.SmsVerificationSessions
      .AsNoTracking()
      .FirstAsync(x => x.Id == registrationId);

    Assert.Equal(SmsVerificationStatus.Pending, session.Status);
    Assert.Equal(4, session.ResendsRemaining);
  }

  [Fact]
  public async Task RegisterVerify_Twice_ShouldReturnAlreadyCompletedOnSecondAttempt()
  {
    using var client = CreateClient();
    var phone = NextPhoneNumber();

    var requestResponse = await client.PostAsJsonAsync("/api/clients/register/request", new
    {
      Name = "Double Verify User",
      PhoneNumber = phone,
      Password = "Pass123!"
    });

    Assert.Equal(HttpStatusCode.OK, requestResponse.StatusCode);
    var requestPayload = await ReadJsonAsync(requestResponse);
    var registrationId = requestPayload.GetProperty("registrationId").GetGuid();

    var firstVerifyResponse = await client.PostAsJsonAsync("/api/clients/register/verify", new
    {
      RegistrationId = registrationId,
      Code = "111111"
    });
    Assert.Equal(HttpStatusCode.OK, firstVerifyResponse.StatusCode);

    var secondVerifyResponse = await client.PostAsJsonAsync("/api/clients/register/verify", new
    {
      RegistrationId = registrationId,
      Code = "111111"
    });

    Assert.Equal(HttpStatusCode.BadRequest, secondVerifyResponse.StatusCode);
    var secondPayload = await ReadJsonAsync(secondVerifyResponse);
    Assert.Equal("sms_session_already_completed", secondPayload.GetProperty("errorCode").GetString());
    Assert.Equal("already_completed", secondPayload.GetProperty("reason").GetString());
  }

  [Fact]
  public async Task RegisterVerify_WhenSessionExpired_ShouldReturnExpiredError()
  {
    using var client = CreateClient();
    var phone = NextPhoneNumber();

    var requestResponse = await client.PostAsJsonAsync("/api/clients/register/request", new
    {
      Name = "Expired Verify User",
      PhoneNumber = phone,
      Password = "Pass123!"
    });

    Assert.Equal(HttpStatusCode.OK, requestResponse.StatusCode);
    var requestPayload = await ReadJsonAsync(requestResponse);
    var registrationId = requestPayload.GetProperty("registrationId").GetGuid();

    using (var scope = Factory.CreateScope())
    {
      var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
      _ = await db.Database.ExecuteSqlInterpolatedAsync(
        $"UPDATE sms_verification_sessions SET expires_at_utc = {DateTime.UtcNow.AddMinutes(-1)} WHERE id = {registrationId}");
    }

    var verifyResponse = await client.PostAsJsonAsync("/api/clients/register/verify", new
    {
      RegistrationId = registrationId,
      Code = "111111"
    });

    Assert.Equal(HttpStatusCode.BadRequest, verifyResponse.StatusCode);
    var verifyPayload = await ReadJsonAsync(verifyResponse);
    Assert.Equal("sms_code_expired", verifyPayload.GetProperty("errorCode").GetString());
    Assert.Equal("expired", verifyPayload.GetProperty("reason").GetString());

    using var verifyScope = Factory.CreateScope();
    var verifyDb = verifyScope.ServiceProvider.GetRequiredService<AppDbContext>();
    var session = await verifyDb.SmsVerificationSessions
      .AsNoTracking()
      .FirstAsync(x => x.Id == registrationId);

    Assert.Equal(SmsVerificationStatus.Failed, session.Status);
    Assert.Equal("expired", session.FailureReason);
  }

  [Fact]
  public async Task RegisterResend_AfterVerification_ShouldReturnAlreadyCompletedError()
  {
    using var client = CreateClient();
    var phone = NextPhoneNumber();

    var requestResponse = await client.PostAsJsonAsync("/api/clients/register/request", new
    {
      Name = "Resend After Verify User",
      PhoneNumber = phone,
      Password = "Pass123!"
    });

    Assert.Equal(HttpStatusCode.OK, requestResponse.StatusCode);
    var requestPayload = await ReadJsonAsync(requestResponse);
    var registrationId = requestPayload.GetProperty("registrationId").GetGuid();

    var verifyResponse = await client.PostAsJsonAsync("/api/clients/register/verify", new
    {
      RegistrationId = registrationId,
      Code = "111111"
    });
    Assert.Equal(HttpStatusCode.OK, verifyResponse.StatusCode);

    var resendResponse = await client.PostAsJsonAsync("/api/clients/register/resend", new
    {
      RegistrationId = registrationId
    });

    Assert.Equal(HttpStatusCode.BadRequest, resendResponse.StatusCode);
    var resendPayload = await ReadJsonAsync(resendResponse);
    Assert.Equal("sms_session_already_completed", resendPayload.GetProperty("errorCode").GetString());
    Assert.Equal("already_completed", resendPayload.GetProperty("reason").GetString());
  }

  private static string NextPhoneNumber()
  {
    var next = Interlocked.Increment(ref _phoneCounter) % 10_000_000;
    return $"97{next:D7}";
  }
}
