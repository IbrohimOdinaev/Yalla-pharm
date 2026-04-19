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
using Yalla.Infrastructure.WooCommerce;
using Yalla.Infrastructure.Jura;
using Yalla.Infrastructure.Search;
using Yalla.Application.Common;
using Yalla.Application.Services;

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
      options.CreateOrderOnlyAfterAdminPaymentConfirmation = !bool.TryParse(
        config[$"{DushanbeCityPaymentOptions.SectionName}:CreateOrderOnlyAfterAdminPaymentConfirmation"],
        out var createOrderOnlyAfterAdminPaymentConfirmation)
        || createOrderOnlyAfterAdminPaymentConfirmation;
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
      options.AuthMode = config[$"{OsonSmsOptions.SectionName}:AuthMode"] ?? "Bearer";
      options.Login = config[$"{OsonSmsOptions.SectionName}:Login"] ?? string.Empty;
      options.Token = config[$"{OsonSmsOptions.SectionName}:Token"] ?? string.Empty;
      options.Sender = config[$"{OsonSmsOptions.SectionName}:Sender"] ?? string.Empty;
      options.PassSaltHash = config[$"{OsonSmsOptions.SectionName}:PassSaltHash"] ?? string.Empty;
      options.Delimiter = config[$"{OsonSmsOptions.SectionName}:Delimiter"] ?? ";";
      options.T = config[$"{OsonSmsOptions.SectionName}:T"] ?? "23";
      options.IsConfidential = bool.TryParse(config[$"{OsonSmsOptions.SectionName}:IsConfidential"], out var isConfidential)
        && isConfidential;
      options.UseStub = !bool.TryParse(config[$"{OsonSmsOptions.SectionName}:UseStub"], out var useStub) || useStub;
      options.TimeoutSeconds = int.TryParse(config[$"{OsonSmsOptions.SectionName}:TimeoutSeconds"], out var timeoutSeconds)
        ? timeoutSeconds
        : 20;
      options.MaxRetryAttempts = int.TryParse(config[$"{OsonSmsOptions.SectionName}:MaxRetryAttempts"], out var maxRetryAttempts)
        ? maxRetryAttempts
        : 2;
      options.RetryBackoffSeconds = int.TryParse(config[$"{OsonSmsOptions.SectionName}:RetryBackoffSeconds"], out var retryBackoffSeconds)
        ? retryBackoffSeconds
        : 2;
    });
    services.Configure<SmsOutboxOptions>(options =>
    {
      options.Enabled = !bool.TryParse(config[$"{SmsOutboxOptions.SectionName}:Enabled"], out var enabled) || enabled;
      options.BatchSize = int.TryParse(config[$"{SmsOutboxOptions.SectionName}:BatchSize"], out var batchSize)
        ? batchSize
        : 50;
      options.PollIntervalSeconds = int.TryParse(config[$"{SmsOutboxOptions.SectionName}:PollIntervalSeconds"], out var pollIntervalSeconds)
        ? pollIntervalSeconds
        : 15;
      options.MaxAttempts = int.TryParse(config[$"{SmsOutboxOptions.SectionName}:MaxAttempts"], out var maxAttempts)
        ? maxAttempts
        : 5;
      options.RetryBackoffSeconds = int.TryParse(config[$"{SmsOutboxOptions.SectionName}:RetryBackoffSeconds"], out var retryBackoffSeconds)
        ? retryBackoffSeconds
        : 30;
      options.RetentionDays = int.TryParse(config[$"{SmsOutboxOptions.SectionName}:RetentionDays"], out var retentionDays)
        ? retentionDays
        : 7;
    });
    services.Configure<SmsTemplatesOptions>(options =>
    {
      options.Provider = config[$"{SmsTemplatesOptions.SectionName}:Provider"] ?? "OsonSms";
      options.PaymentConfirmed = config[$"{SmsTemplatesOptions.SectionName}:PaymentConfirmed"] ?? options.PaymentConfirmed;

      var section = config.GetSection($"{SmsTemplatesOptions.SectionName}:OrderStatus");
      options.OrderStatus = section.GetChildren()
        .Where(x => !string.IsNullOrWhiteSpace(x.Key))
        .ToDictionary(
          x => x.Key,
          x => x.Value ?? string.Empty,
          StringComparer.OrdinalIgnoreCase);

      var juraSection = config.GetSection($"{SmsTemplatesOptions.SectionName}:JuraDelivery");
      options.JuraDelivery = juraSection.GetChildren()
        .Where(x => !string.IsNullOrWhiteSpace(x.Key))
        .ToDictionary(
          x => x.Key,
          x => x.Value ?? string.Empty,
          StringComparer.OrdinalIgnoreCase);
    });
    services.AddHttpClient<OsonSmsSender>((provider, client) =>
    {
      var smsOptions = provider.GetRequiredService<IOptions<OsonSmsOptions>>().Value;
      client.BaseAddress = new Uri(smsOptions.ApiBaseUrl);
      client.Timeout = TimeSpan.FromSeconds(Math.Max(5, smsOptions.TimeoutSeconds));
    });
    services.AddSingleton<IOsonSmsRequestSigner, OsonBearerSigner>();
    services.AddSingleton<IOsonSmsRequestSigner, OsonHashSigner>();
    services.AddScoped<StubSmsSender>();
    services.AddScoped<ISmsSender>(provider =>
    {
      var smsOptions = provider.GetRequiredService<IOptions<OsonSmsOptions>>().Value;
      if (smsOptions.UseStub)
        return provider.GetRequiredService<StubSmsSender>();

      return provider.GetRequiredService<OsonSmsSender>();
    });
    services.AddHostedService<SmsVerificationCleanupHostedService>();
    services.AddHostedService<OrderStatusSmsEnqueueHostedService>();
    services.AddHostedService<SmsOutboxDispatcherHostedService>();
    services.AddHostedService<ManualPaymentTimeoutHostedService>();

    // WooCommerce sync
    services.Configure<WooCommerceOptions>(config.GetSection(WooCommerceOptions.SectionName));
    services.AddHttpClient<WooCommerceSyncService>(client =>
    {
      client.Timeout = TimeSpan.FromSeconds(30);
    });
    services.AddScoped<IWooCommerceSyncService, WooCommerceSyncService>();
    services.AddHostedService<WooCommercePollHostedService>();

    // Jura delivery service
    services.Configure<JuraOptions>(options =>
    {
      options.BaseUrl = config[$"{JuraOptions.SectionName}:BaseUrl"] ?? string.Empty;
      options.Login = config[$"{JuraOptions.SectionName}:Login"] ?? string.Empty;
      options.Password = config[$"{JuraOptions.SectionName}:Password"] ?? string.Empty;
      options.DivisionId = int.TryParse(config[$"{JuraOptions.SectionName}:DivisionId"], out var divisionId)
        ? divisionId
        : 6;
      options.DefaultTariffId = int.TryParse(config[$"{JuraOptions.SectionName}:DefaultTariffId"], out var tariffId)
        ? tariffId
        : 37;
    });
    services.AddSingleton<IJuraHealthState, JuraHealthState>();
    services.AddHttpClient<JuraService>((provider, client) =>
    {
      var juraOptions = provider.GetRequiredService<IOptions<JuraOptions>>().Value;
      if (!string.IsNullOrEmpty(juraOptions.BaseUrl))
        client.BaseAddress = new Uri(juraOptions.BaseUrl);
      client.Timeout = TimeSpan.FromSeconds(15);
    });
    services.AddScoped<IJuraService>(provider => provider.GetRequiredService<JuraService>());
    services.AddHostedService<JuraDeliveryStatusSyncHostedService>();

    // Elasticsearch
    var esUrl = config["Elasticsearch:Url"] ?? "http://localhost:9200";
    var esIndex = config["Elasticsearch:MedicineIndex"] ?? "medicines";
    services.AddScoped<IMedicineSearchEngine>(sp =>
        new ElasticsearchMedicineSearchEngine(
            esUrl,
            sp.GetRequiredService<IAppDbContext>(),
            sp.GetRequiredService<Microsoft.Extensions.Logging.ILogger<ElasticsearchMedicineSearchEngine>>(),
            esIndex));
    services.AddHostedService<ElasticsearchReindexHostedService>();

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
