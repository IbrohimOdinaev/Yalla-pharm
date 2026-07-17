using Microsoft.Extensions.Configuration;
using Npgsql;

namespace Yalla.Application.UnitTests.Infrastructure;

public sealed class DatabaseConnectionStringTests
{
  [Fact]
  public void NormalizeConnectionString_AddsConfiguredPoolLimits_WhenMissing()
  {
    var config = new ConfigurationBuilder()
      .AddInMemoryCollection(new Dictionary<string, string?>
      {
        ["Database:MaxPoolSize"] = "12",
        ["Database:ConnectionIdleLifetimeSeconds"] = "30",
        ["Database:ConnectionTimeoutSeconds"] = "5"
      })
      .Build();

    var normalized = Yalla.Infrastructure.DependencyInjection.NormalizeConnectionString(
      "Host=db.example;Database=pharm;Username=app;Password=secret",
      config);

    var builder = new NpgsqlConnectionStringBuilder(normalized);
    Assert.Equal(12, builder.MaxPoolSize);
    Assert.Equal(30, builder.ConnectionIdleLifetime);
    Assert.Equal(5, builder.Timeout);
    Assert.Equal("public", builder.SearchPath);
  }

  [Fact]
  public void NormalizeConnectionString_DoesNotOverrideExplicitPoolLimits()
  {
    var config = new ConfigurationBuilder()
      .AddInMemoryCollection(new Dictionary<string, string?>
      {
        ["Database:MaxPoolSize"] = "12",
        ["Database:ConnectionIdleLifetimeSeconds"] = "30"
      })
      .Build();

    var normalized = Yalla.Infrastructure.DependencyInjection.NormalizeConnectionString(
      "Host=db.example;Database=pharm;Username=app;Password=secret;Maximum Pool Size=40;Connection Idle Lifetime=90",
      config);

    var builder = new NpgsqlConnectionStringBuilder(normalized);
    Assert.Equal(40, builder.MaxPoolSize);
    Assert.Equal(90, builder.ConnectionIdleLifetime);
  }
}
