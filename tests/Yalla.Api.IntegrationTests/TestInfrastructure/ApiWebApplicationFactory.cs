using ApplicationDbContext = Yalla.Infrastructure.AppDbContext;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Yalla.Application.Abstractions;

namespace Yalla.Api.IntegrationTests.TestInfrastructure;

public sealed class ApiWebApplicationFactory : WebApplicationFactory<Program>
{
  private readonly SqliteConnection _connection;
  private readonly IServiceProvider _sqliteEntityFrameworkServices;

  public ApiWebApplicationFactory()
  {
    _connection = new SqliteConnection("Data Source=:memory:");
    _connection.Open();

    _sqliteEntityFrameworkServices = new ServiceCollection()
      .AddEntityFrameworkSqlite()
      .BuildServiceProvider();
  }

  protected override void ConfigureWebHost(IWebHostBuilder builder)
  {
    builder.UseEnvironment("IntegrationTests");

    builder.ConfigureServices(services =>
    {
      services.RemoveAll<DbContextOptions<ApplicationDbContext>>();
      services.RemoveAll<IDbContextOptionsConfiguration<ApplicationDbContext>>();
      services.RemoveAll<ApplicationDbContext>();
      services.RemoveAll<IAppDbContext>();
      services.RemoveAll<IMedicineImageStorage>();

      services.AddDbContext<ApplicationDbContext>(options =>
        options
          .UseSqlite(_connection)
          .UseInternalServiceProvider(_sqliteEntityFrameworkServices));

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

  public async Task ResetDatabaseAsync()
  {
    _ = Services;

    using var scope = Services.CreateScope();
    var dbContext = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

    await dbContext.Database.EnsureDeletedAsync();
    await dbContext.Database.EnsureCreatedAsync();
    await ApiTestData.SeedAsync(dbContext);
  }

  public IServiceScope CreateScope()
  {
    return Services.CreateScope();
  }

  protected override void Dispose(bool disposing)
  {
    if (disposing)
      _connection.Dispose();

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
