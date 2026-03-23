using System.Reflection;
using Api.Controllers;
using Microsoft.AspNetCore.RateLimiting;

namespace Yalla.Application.UnitTests.Api;

public sealed class ClientsControllerRateLimitTests
{
  [Theory]
  [InlineData(nameof(ClientsController.RequestRegistrationVerification), "sms-register-request")]
  [InlineData(nameof(ClientsController.VerifyRegistration), "sms-register-verify")]
  [InlineData(nameof(ClientsController.ResendRegistrationCode), "sms-register-resend")]
  public void SmsEndpoints_ShouldHaveExpectedRateLimitPolicy(
    string methodName,
    string expectedPolicy)
  {
    var method = typeof(ClientsController).GetMethod(
      methodName,
      BindingFlags.Instance | BindingFlags.Public);

    Assert.NotNull(method);

    var rateLimitAttribute = method!.GetCustomAttribute<EnableRateLimitingAttribute>();
    Assert.NotNull(rateLimitAttribute);
    Assert.Equal(expectedPolicy, rateLimitAttribute!.PolicyName);
  }
}
