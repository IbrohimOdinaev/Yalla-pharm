using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using Yalla.Application.Common;
using Yalla.Application.Services;
using Yalla.Application.UnitTests.TestInfrastructure;
using Yalla.Domain.Exceptions;

namespace Yalla.Application.UnitTests.Services;

public sealed class PrivacyPolicyServiceTests
{
  private static IOptions<ComplianceOptions> OptionsFor(string version) =>
    Options.Create(new ComplianceOptions
    {
      PrivacyPolicyCurrentVersion = version,
      PrivacyPolicyEffectiveDate = "2026-05-12",
    });

  [Fact]
  public async Task AcceptAsync_records_acceptance_on_client_and_history()
  {
    using var scope = TestDbFactory.Create();
    var client = TestDbFactory.CreateClient("Иван", "111111111");
    scope.Db.Clients.Add(client);
    await scope.Db.SaveChangesAsync();

    var service = new PrivacyPolicyService(scope.Db, OptionsFor("1.0-2026-05-12"));

    await service.AcceptAsync(client.Id, "1.0-2026-05-12", "192.0.2.1", "Mozilla/5.0");

    var stored = await scope.Db.Clients.AsNoTracking().SingleAsync(c => c.Id == client.Id);
    Assert.Equal("1.0-2026-05-12", stored.PrivacyPolicyVersionAccepted);
    Assert.NotNull(stored.PrivacyPolicyAcceptedAtUtc);
    Assert.Equal("192.0.2.1", stored.PrivacyPolicyAcceptedFromIp);

    var history = await scope.Db.ClientConsentHistory.AsNoTracking().SingleAsync();
    Assert.Equal(client.Id, history.ClientId);
    Assert.Equal("1.0-2026-05-12", history.PolicyVersion);
    Assert.Equal("Mozilla/5.0", history.UserAgent);
  }

  [Fact]
  public async Task AcceptAsync_rejects_wrong_version_with_400()
  {
    using var scope = TestDbFactory.Create();
    var client = TestDbFactory.CreateClient("Иван", "111111111");
    scope.Db.Clients.Add(client);
    await scope.Db.SaveChangesAsync();

    var service = new PrivacyPolicyService(scope.Db, OptionsFor("1.0-2026-05-12"));

    var ex = await Assert.ThrowsAsync<ClientErrorException>(() =>
      service.AcceptAsync(client.Id, "0.9-old", "1.1.1.1", null));

    Assert.Equal("privacy_policy_version_mismatch", ex.ErrorCode);
    Assert.Equal(400, ex.StatusCode);
  }

  [Fact]
  public async Task HasAcceptedCurrentAsync_returns_false_when_outdated()
  {
    using var scope = TestDbFactory.Create();
    var client = TestDbFactory.CreateClient("Иван", "111111111");
    scope.Db.Clients.Add(client);
    await scope.Db.SaveChangesAsync();

    // Accept the OLD version, then ask whether the NEW one's accepted.
    var oldService = new PrivacyPolicyService(scope.Db, OptionsFor("1.0-2026-05-12"));
    await oldService.AcceptAsync(client.Id, "1.0-2026-05-12", null, null);

    var newService = new PrivacyPolicyService(scope.Db, OptionsFor("1.1-2026-08-01"));
    var accepted = await newService.HasAcceptedCurrentAsync(client.Id);

    Assert.False(accepted);
  }

  [Fact]
  public async Task HasAcceptedCurrentAsync_returns_true_after_accept()
  {
    using var scope = TestDbFactory.Create();
    var client = TestDbFactory.CreateClient("Иван", "111111111");
    scope.Db.Clients.Add(client);
    await scope.Db.SaveChangesAsync();

    var service = new PrivacyPolicyService(scope.Db, OptionsFor("1.0-2026-05-12"));
    Assert.False(await service.HasAcceptedCurrentAsync(client.Id));

    await service.AcceptAsync(client.Id, "1.0-2026-05-12", null, null);
    Assert.True(await service.HasAcceptedCurrentAsync(client.Id));
  }

  [Fact]
  public void GetCurrent_returns_configured_metadata()
  {
    using var scope = TestDbFactory.Create();
    var service = new PrivacyPolicyService(scope.Db, OptionsFor("1.0-2026-05-12"));

    var meta = service.GetCurrent();
    Assert.Equal("1.0-2026-05-12", meta.Version);
    Assert.Equal("2026-05-12", meta.EffectiveDate);
  }
}
