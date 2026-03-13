using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Npgsql;
using Yalla.Application.Abstractions;
using Yalla.Infrastructure.Security;
using Yalla.Infrastructure.Storage;

namespace Yalla.Infrastructure;

public static class DependencyInjection
{
  public static IServiceCollection AddInfrastructure(this IServiceCollection services, IConfiguration config)
  {
    var connectionString = NormalizeConnectionStringForContainer(config.GetConnectionString("Default"), config);

    services.AddDbContext<AppDbContext>(options =>
        options.UseNpgsql(connectionString));

    services.AddScoped<IAppDbContext>(provider => provider.GetRequiredService<AppDbContext>());
    services.AddScoped<IPasswordHasher, PasswordHasher>();
    services.AddScoped<IJwtTokenProvider, JwtTokenProvider>();
    services.Configure<MinIoOptions>(options =>
    {
      options.Endpoint = NormalizeMinIoEndpointForContainer(
        config[$"{MinIoOptions.SectionName}:Endpoint"] ?? string.Empty,
        config);
      options.AccessKey = config[$"{MinIoOptions.SectionName}:AccessKey"] ?? string.Empty;
      options.SecretKey = config[$"{MinIoOptions.SectionName}:SecretKey"] ?? string.Empty;
      options.BucketName = config[$"{MinIoOptions.SectionName}:BucketName"] ?? string.Empty;
      options.UseSsl = bool.TryParse(config[$"{MinIoOptions.SectionName}:UseSsl"], out var useSsl) && useSsl;
    });

    services.AddSingleton<IMedicineImageStorage, MinIoMedicineImageStorage>();

    return services;
  }

  private static string? NormalizeConnectionStringForContainer(string? connectionString, IConfiguration config)
  {
    if (!IsRunningInContainer() || string.IsNullOrWhiteSpace(connectionString))
      return connectionString;

    var builder = new NpgsqlConnectionStringBuilder(connectionString);
    if (IsLocalHost(builder.Host))
      builder.Host = config["Database:ContainerHost"] ?? "yalla-postgres";

    return builder.ConnectionString;
  }

  private static string NormalizeMinIoEndpointForContainer(string endpoint, IConfiguration config)
  {
    if (!IsRunningInContainer() || string.IsNullOrWhiteSpace(endpoint))
      return endpoint;

    var normalized = endpoint.Trim();
    if (normalized.StartsWith("localhost:", StringComparison.OrdinalIgnoreCase)
      || normalized.StartsWith("127.0.0.1:", StringComparison.OrdinalIgnoreCase))
    {
      return config[$"{MinIoOptions.SectionName}:ContainerEndpoint"] ?? "yalla-minio:9000";
    }

    return normalized;
  }

  private static bool IsRunningInContainer()
  {
    var value = Environment.GetEnvironmentVariable("DOTNET_RUNNING_IN_CONTAINER");
    return string.Equals(value, "true", StringComparison.OrdinalIgnoreCase)
      || string.Equals(value, "1", StringComparison.OrdinalIgnoreCase);
  }

  private static bool IsLocalHost(string? host)
  {
    if (string.IsNullOrWhiteSpace(host))
      return false;

    return string.Equals(host, "localhost", StringComparison.OrdinalIgnoreCase)
      || string.Equals(host, "127.0.0.1", StringComparison.OrdinalIgnoreCase)
      || string.Equals(host, "::1", StringComparison.OrdinalIgnoreCase);
  }
}
