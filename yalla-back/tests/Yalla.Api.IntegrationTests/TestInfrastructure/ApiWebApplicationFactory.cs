using ApplicationDbContext = Yalla.Infrastructure.AppDbContext;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Yalla.Application.Abstractions;

namespace Yalla.Api.IntegrationTests.TestInfrastructure;

public sealed class ApiWebApplicationFactory : WebApplicationFactory<Program>
{
  // Static seed runs before any Program.Main invocation: under minimal hosting,
  // Program.cs reads Jwt:Key via builder.Configuration before WebApplicationFactory
  // gets a chance to apply ConfigureAppConfiguration, so the overrides have to be
  // exposed via environment variables (which participate in config at startup).
  static ApiWebApplicationFactory()
  {
    void SetIfUnset(string key, string value)
    {
      if (string.IsNullOrEmpty(Environment.GetEnvironmentVariable(key)))
        Environment.SetEnvironmentVariable(key, value);
    }

    SetIfUnset("Jwt__Key", "IntegrationTestJwtKey_AtLeast32CharactersLong_DoNotUseInProd!");
    SetIfUnset("Jwt__Issuer", "Yalla.Api.IntegrationTests");
    SetIfUnset("Jwt__Audience", "Yalla.Api.IntegrationTests.Client");
    SetIfUnset("Jwt__AccessTokenMinutes", "60");
    SetIfUnset("OsonSms__UseStub", "true");
    SetIfUnset("SmsOutbox__Enabled", "false");
    // Factory swaps Npgsql→SQLite at ConfigureServices; prod Migrate() would fail on SQLite.
    SetIfUnset("Database__ApplyMigrationsOnStartup", "false");
    SetIfUnset("Jura__BaseUrl", "");
    SetIfUnset("Jura__Login", "");
    SetIfUnset("Jura__Password", "");
    SetIfUnset("Elasticsearch__Url", "");
  }

  private readonly string _connectionString;
  private readonly string _dbFilePath;
  private readonly SqliteConnection _keepAliveConnection;
  private readonly IServiceProvider _sqliteEntityFrameworkServices;
  private readonly IReadOnlyDictionary<string, string?> _configurationOverrides;

  public ApiWebApplicationFactory()
    : this(null)
  {
  }

  internal ApiWebApplicationFactory(IReadOnlyDictionary<string, string?>? configurationOverrides)
  {
    // Temp-file SQLite DB per factory: shared across all DbContext scopes, auto
    // cleaned up on dispose. In-memory SQLite with shared-cache was unreliable
    // under .NET 9 + minimal hosting when multiple connections open/close.
    var tempPath = Path.Combine(Path.GetTempPath(), $"yalla-tests-{Guid.NewGuid():N}.db");
    _dbFilePath = tempPath;
    _connectionString = $"Data Source={tempPath}";
    _keepAliveConnection = new SqliteConnection(_connectionString);
    _keepAliveConnection.Open();

    _configurationOverrides = configurationOverrides ?? new Dictionary<string, string?>(StringComparer.Ordinal);

    _sqliteEntityFrameworkServices = new ServiceCollection()
      .AddEntityFrameworkSqlite()
      .BuildServiceProvider();
  }

  protected override void ConfigureWebHost(IWebHostBuilder builder)
  {
    builder.UseEnvironment("IntegrationTests");

    builder.ConfigureAppConfiguration((_, config) =>
    {
      var settings = new Dictionary<string, string?>(StringComparer.Ordinal)
      {
        ["Jwt:Key"] = "IntegrationTestJwtKey_AtLeast32CharactersLong_DoNotUseInProd!",
        ["Jwt:Issuer"] = "Yalla.Api.IntegrationTests",
        ["Jwt:Audience"] = "Yalla.Api.IntegrationTests.Client",
        ["Jwt:AccessTokenMinutes"] = "60",
        ["SmsVerification:RegistrationEnabled"] = "true",
        ["SmsVerification:AllowRegistrationBypass"] = "true",
        ["SmsVerification:CodeLength"] = "6",
        ["SmsVerification:FixedCodeForTests"] = "111111",
        ["SmsVerification:RequestRateLimitPerMinute"] = "1000",
        ["SmsVerification:VerifyRateLimitPerMinute"] = "1000",
        ["SmsVerification:ResendRateLimitPerMinute"] = "1000",
        ["OsonSms:UseStub"] = "true",
        ["SmsOutbox:Enabled"] = "false",
        ["Jura:BaseUrl"] = "",
        ["Jura:Login"] = "",
        ["Jura:Password"] = ""
      };

      foreach (var entry in _configurationOverrides)
        settings[entry.Key] = entry.Value;

      config.AddInMemoryCollection(settings);
    });

    // ConfigureTestServices runs AFTER application's ConfigureServices, so our
    // DbContext registration wins over the Npgsql one from InfrastructureDI.
    builder.ConfigureTestServices(services =>
    {
      services.RemoveAll<DbContextOptions<ApplicationDbContext>>();
      services.RemoveAll<IDbContextOptionsConfiguration<ApplicationDbContext>>();
      services.RemoveAll<ApplicationDbContext>();
      services.RemoveAll<IAppDbContext>();
      services.RemoveAll<IMedicineImageStorage>();

      services.AddDbContext<ApplicationDbContext>(options =>
        options.UseSqlite(_connectionString));

      services.AddScoped<IAppDbContext>(provider =>
        provider.GetRequiredService<ApplicationDbContext>());
      services.AddSingleton<IMedicineImageStorage, InMemoryMedicineImageStorage>();
    });
  }

  public HttpClient CreateApiClient()
  {
    return CreateClient(new WebApplicationFactoryClientOptions
    {
      BaseAddress = new Uri("https://localhost"),
      AllowAutoRedirect = false
    });
  }

  private bool _schemaCreated;
  private readonly SemaphoreSlim _schemaLock = new(1, 1);

  public async Task ResetDatabaseAsync()
  {
    _ = Services;

    using var scope = Services.CreateScope();
    var dbContext = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

    // In-memory SQLite can't be dropped via EnsureDeleted reliably; create schema
    // once (guarded) and then wipe rows between tests.
    if (!_schemaCreated)
    {
      await _schemaLock.WaitAsync();
      try
      {
        if (!_schemaCreated)
        {
          await dbContext.Database.EnsureCreatedAsync();
          _schemaCreated = true;
        }
      }
      finally
      {
        _schemaLock.Release();
      }
    }
    else
    {
      await TruncateAllTablesAsync(dbContext);
    }

    await ApiTestData.SeedAsync(dbContext);
  }

  private static async Task TruncateAllTablesAsync(ApplicationDbContext dbContext)
  {
    // SQLite: disable FK checks, delete everything, re-enable.
    await dbContext.Database.ExecuteSqlRawAsync("PRAGMA foreign_keys=OFF");
    var tables = dbContext.Model.GetEntityTypes()
      .Select(t => t.GetTableName())
      .Where(t => !string.IsNullOrEmpty(t))
      .Distinct()
      .ToList();
    foreach (var table in tables)
    {
      await dbContext.Database.ExecuteSqlRawAsync($"DELETE FROM \"{table}\"");
    }
    await dbContext.Database.ExecuteSqlRawAsync("PRAGMA foreign_keys=ON");
  }

  public IServiceScope CreateScope()
  {
    return Services.CreateScope();
  }

  protected override void Dispose(bool disposing)
  {
    if (disposing)
    {
      _keepAliveConnection.Dispose();
      SqliteConnection.ClearAllPools();
      try { if (File.Exists(_dbFilePath)) File.Delete(_dbFilePath); } catch { /* best-effort */ }
    }

    base.Dispose(disposing);
  }
}

internal sealed class InMemoryMedicineImageStorage : IMedicineImageStorage
{
  private readonly Dictionary<string, byte[]> _storage = new(StringComparer.Ordinal);

  public async Task<string> UploadAsync(
    Stream content,
    string contentType,
    string fileName,
    CancellationToken cancellationToken = default)
  {
    using var memory = new MemoryStream();
    await content.CopyToAsync(memory, cancellationToken);

    var key = $"test/{Guid.NewGuid():N}";
    _storage[key] = memory.ToArray();
    return key;
  }

  public Task<string> GetUrlAsync(string key, CancellationToken cancellationToken = default)
  {
    return Task.FromResult($"/test-images/{key}");
  }

  public Task<MedicineImageContent> GetContentAsync(
    string key,
    CancellationToken cancellationToken = default)
  {
    var bytes = _storage.TryGetValue(key, out var value) ? value : [];
    return Task.FromResult(new MedicineImageContent
    {
      Content = new MemoryStream(bytes, writable: false),
      ContentType = "image/png"
    });
  }

  public Task DeleteAsync(string key, CancellationToken cancellationToken = default)
  {
    _storage.Remove(key);
    return Task.CompletedTask;
  }
}
