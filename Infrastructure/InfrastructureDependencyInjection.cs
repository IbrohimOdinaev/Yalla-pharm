using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;
using Npgsql;
using Yalla.Application.Abstractions;
using Yalla.Application.Common;
using Yalla.Infrastructure.Payments;
using Yalla.Infrastructure.Security;
using Yalla.Infrastructure.Sms;
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
    services.Configure<DushanbeCityPaymentOptions>(options =>
    {
      options.BaseUrl = config[$"{DushanbeCityPaymentOptions.SectionName}:BaseUrl"] ?? options.BaseUrl;
      options.ProviderName = config[$"{DushanbeCityPaymentOptions.SectionName}:ProviderName"] ?? options.ProviderName;
      options.Currency = config[$"{DushanbeCityPaymentOptions.SectionName}:Currency"] ?? options.Currency;
      options.PendingConfirmationTimeoutMinutes = int.TryParse(
        config[$"{DushanbeCityPaymentOptions.SectionName}:PendingConfirmationTimeoutMinutes"],
        out var pendingConfirmationTimeoutMinutes)
        ? pendingConfirmationTimeoutMinutes
        : options.PendingConfirmationTimeoutMinutes;
      options.CleanupIntervalSeconds = int.TryParse(
        config[$"{DushanbeCityPaymentOptions.SectionName}:CleanupIntervalSeconds"],
        out var cleanupIntervalSeconds)
        ? cleanupIntervalSeconds
        : options.CleanupIntervalSeconds;
    });

    services.AddSingleton<IMedicineImageStorage, MinIoMedicineImageStorage>();
    services.Configure<SmsVerificationOptions>(options =>
    {
      options.RegistrationEnabled = !bool.TryParse(config[$"{SmsVerificationOptions.SectionName}:RegistrationEnabled"], out var registrationEnabled)
        || registrationEnabled;
      options.AllowRegistrationBypass = bool.TryParse(config[$"{SmsVerificationOptions.SectionName}:AllowRegistrationBypass"], out var allowBypass)
        && allowBypass;
      options.CodeLength = int.TryParse(config[$"{SmsVerificationOptions.SectionName}:CodeLength"], out var codeLength)
        ? codeLength
        : 6;
      options.CodeTtlMinutes = int.TryParse(config[$"{SmsVerificationOptions.SectionName}:CodeTtlMinutes"], out var codeTtlMinutes)
        ? codeTtlMinutes
        : 10;
      options.ResendCooldownSeconds = int.TryParse(config[$"{SmsVerificationOptions.SectionName}:ResendCooldownSeconds"], out var resendCooldownSeconds)
        ? resendCooldownSeconds
        : 60;
      options.MaxVerificationAttempts = int.TryParse(config[$"{SmsVerificationOptions.SectionName}:MaxVerificationAttempts"], out var maxAttempts)
        ? maxAttempts
        : 5;
      options.MaxResendCount = int.TryParse(config[$"{SmsVerificationOptions.SectionName}:MaxResendCount"], out var maxResendCount)
        ? maxResendCount
        : 5;
      options.RequestRateLimitPerMinute = int.TryParse(config[$"{SmsVerificationOptions.SectionName}:RequestRateLimitPerMinute"], out var requestRateLimitPerMinute)
        ? requestRateLimitPerMinute
        : 10;
      options.VerifyRateLimitPerMinute = int.TryParse(config[$"{SmsVerificationOptions.SectionName}:VerifyRateLimitPerMinute"], out var verifyRateLimitPerMinute)
        ? verifyRateLimitPerMinute
        : 30;
      options.ResendRateLimitPerMinute = int.TryParse(config[$"{SmsVerificationOptions.SectionName}:ResendRateLimitPerMinute"], out var resendRateLimitPerMinute)
        ? resendRateLimitPerMinute
        : 10;
      options.CleanupIntervalMinutes = int.TryParse(config[$"{SmsVerificationOptions.SectionName}:CleanupIntervalMinutes"], out var cleanupIntervalMinutes)
        ? cleanupIntervalMinutes
        : 15;
      options.ExpiredSessionRetentionMinutes = int.TryParse(config[$"{SmsVerificationOptions.SectionName}:ExpiredSessionRetentionMinutes"], out var expiredRetentionMinutes)
        ? expiredRetentionMinutes
        : 120;
      options.CompletedSessionRetentionHours = int.TryParse(config[$"{SmsVerificationOptions.SectionName}:CompletedSessionRetentionHours"], out var completedRetentionHours)
        ? completedRetentionHours
        : 24;
      options.MessageTemplate = config[$"{SmsVerificationOptions.SectionName}:MessageTemplate"] ?? options.MessageTemplate;
      options.FixedCodeForTests = config[$"{SmsVerificationOptions.SectionName}:FixedCodeForTests"] ?? options.FixedCodeForTests;
    });
    services.Configure<OsonSmsOptions>(options =>
    {
      options.ApiBaseUrl = config[$"{OsonSmsOptions.SectionName}:ApiBaseUrl"] ?? "https://api.osonsms.com";
      options.Login = config[$"{OsonSmsOptions.SectionName}:Login"] ?? string.Empty;
      options.Token = config[$"{OsonSmsOptions.SectionName}:Token"] ?? string.Empty;
      options.Sender = config[$"{OsonSmsOptions.SectionName}:Sender"] ?? string.Empty;
      options.IsConfidential = bool.TryParse(config[$"{OsonSmsOptions.SectionName}:IsConfidential"], out var isConfidential)
        && isConfidential;
      options.UseStub = !bool.TryParse(config[$"{OsonSmsOptions.SectionName}:UseStub"], out var useStub) || useStub;
      options.TimeoutSeconds = int.TryParse(config[$"{OsonSmsOptions.SectionName}:TimeoutSeconds"], out var timeoutSeconds)
        ? timeoutSeconds
        : 20;
    });
    services.AddHttpClient<OsonSmsSender>((provider, client) =>
    {
      var smsOptions = provider.GetRequiredService<IOptions<OsonSmsOptions>>().Value;
      client.BaseAddress = new Uri(smsOptions.ApiBaseUrl);
      client.Timeout = TimeSpan.FromSeconds(Math.Max(5, smsOptions.TimeoutSeconds));
    });
    services.AddScoped<StubSmsSender>();
    services.AddScoped<ISmsSender>(provider =>
    {
      var smsOptions = provider.GetRequiredService<IOptions<OsonSmsOptions>>().Value;
      if (smsOptions.UseStub)
        return provider.GetRequiredService<StubSmsSender>();

      return provider.GetRequiredService<OsonSmsSender>();
    });
    services.AddHostedService<SmsVerificationCleanupHostedService>();
    services.AddHostedService<ManualPaymentTimeoutHostedService>();

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
