using Microsoft.Extensions.DependencyInjection;
using Yalla.Api.IntegrationTests.TestInfrastructure;
using Yalla.Application.Abstractions;
using Yalla.Infrastructure.Sms;

namespace Yalla.Api.IntegrationTests;

public sealed class SmsInfrastructureIntegrationTests : ApiTestBase
{
  public SmsInfrastructureIntegrationTests(ApiWebApplicationFactory factory)
    : base(factory)
  {
  }

  [Fact]
  public void SmsSender_ShouldResolveToStub_WhenConfigured()
  {
    using var scope = Factory.CreateScope();
    var smsSender = scope.ServiceProvider.GetRequiredService<ISmsSender>();

    Assert.IsType<StubSmsSender>(smsSender);
  }
}
