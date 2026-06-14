using Microsoft.Extensions.Options;
using Yalla.Application.Common;
using Yalla.Application.Services;
using Yalla.Application.UnitTests.TestInfrastructure;
using Yalla.Domain.Entities;

namespace Yalla.Application.UnitTests.Services;

public sealed class PaymentSettingsServiceTests
{
  [Fact]
  public async Task GetSnapshotAsync_ShouldUseSavedAlifDynamicLink()
  {
    using var scope = TestDbFactory.Create();
    var db = scope.Db;
    var settings = new PaymentSettings(PaymentSettings.SingletonId);
    settings.SetAlifUrlTemplate("https://alifmobi.page.link/toMobi?account=+992926406699&summa={amount}&_imcp=1", Guid.NewGuid());
    db.PaymentSettings.Add(settings);
    await db.SaveChangesAsync();

    var service = new PaymentSettingsService(
      db,
      Options.Create(new DushanbeCityPaymentOptions
      {
        AlifUrlTemplate = "https://alifmobi.page.link/toMobi?account=%2B992926406699&summa={amount}&_imcp=1",
      }));

    var snapshot = await service.GetSnapshotAsync();

    Assert.Equal("https://alifmobi.page.link/toMobi?account=+992926406699&summa={amount}&_imcp=1", snapshot.AlifUrlTemplate);
    Assert.Equal("https://alifmobi.page.link/toMobi?account=%2B992926406699&summa={amount}&_imcp=1", snapshot.AlifUrlTemplateEffective);
  }

  [Fact]
  public async Task GetSnapshotAsync_ShouldConvertLegacyAlifDeepLinkToDynamicLink()
  {
    using var scope = TestDbFactory.Create();
    var db = scope.Db;
    var settings = new PaymentSettings(PaymentSettings.SingletonId);
    settings.SetAlifUrlTemplate("alifmobi:///toMobi?account=%2B992926406699&summa={amount}&_imcp=1", Guid.NewGuid());
    db.PaymentSettings.Add(settings);
    await db.SaveChangesAsync();

    var service = new PaymentSettingsService(
      db,
      Options.Create(new DushanbeCityPaymentOptions()));

    var snapshot = await service.GetSnapshotAsync();

    Assert.Equal("alifmobi:///toMobi?account=%2B992926406699&summa={amount}&_imcp=1", snapshot.AlifUrlTemplate);
    Assert.Equal("https://alifmobi.page.link/toMobi?account=%2B992926406699&summa={amount}&_imcp=1", snapshot.AlifUrlTemplateEffective);
  }
}
