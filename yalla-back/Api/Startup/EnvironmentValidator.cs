using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

namespace Api.Startup;

/// <summary>
/// Fail-fast validation of the environment configuration. Runs before the
/// app builds — any missing or malformed *critical* setting throws a
/// descriptive exception so misconfigured deploys die immediately instead
/// of crashing later under load with a confusing stack trace. Optional
/// integrations (Telegram, OsonSMS, WooCommerce, JURA, DushanbeCity)
/// only emit warnings — the app stays up but those features degrade.
/// </summary>
public static class EnvironmentValidator
{
    public static void Validate(IConfiguration configuration, ILogger logger)
    {
        ArgumentNullException.ThrowIfNull(configuration);
        ArgumentNullException.ThrowIfNull(logger);

        var failures = new List<string>();

        // ── Critical: app cannot serve a single request without these ─────
        Require(configuration, "ConnectionStrings:Default", failures,
          hint: "PostgreSQL connection string. Set via env DB_CONNECTION_STRING (compose) or directly.");

        var jwtKey = configuration["Jwt:Key"];
        if (string.IsNullOrWhiteSpace(jwtKey))
            failures.Add("Jwt:Key is missing — set env JWT_KEY to a random string of 32+ characters.");
        else if (jwtKey.Length < 32)
            failures.Add($"Jwt:Key must be at least 32 characters long (current: {jwtKey.Length}).");

        Require(configuration, "MinIo:Endpoint", failures,
          hint: "Object storage endpoint host[:port]. Set MINIO_ENDPOINT.");
        Require(configuration, "MinIo:AccessKey", failures, hint: "Set MINIO_ACCESS_KEY.");
        Require(configuration, "MinIo:SecretKey", failures, hint: "Set MINIO_SECRET_KEY.");
        Require(configuration, "MinIo:BucketName", failures, hint: "Set MINIO_BUCKET.");

        var corsOrigins = configuration.GetSection("Cors:AllowedOrigins").Get<string[]>() ?? Array.Empty<string>();
        if (corsOrigins.Length == 0)
            failures.Add("Cors:AllowedOrigins is empty — set at least one origin via CORS_ORIGIN_0 (comma-separated list).");

        if (failures.Count > 0)
        {
            var message = "Environment validation failed:\n  • " + string.Join("\n  • ", failures);
            throw new InvalidOperationException(message);
        }

        // ── Warn-only: app starts, but the listed feature is broken ──────
        WarnIfMissing(configuration, "Telegram:BotToken",
          "Telegram bot will not work (auth-via-Telegram, status push notifications).", logger);

        WarnIfMissing(configuration, "WooCommerce:ConsumerKey",
          "WooCommerce sync (catalog import + price/stock webhook) will not work.", logger);

        var osonStub = string.Equals(configuration["OsonSms:UseStub"], "true", StringComparison.OrdinalIgnoreCase);
        if (!osonStub && string.IsNullOrWhiteSpace(configuration["OsonSms:Token"]))
        {
            logger.LogWarning(
              "OsonSms:Token is empty and OsonSms:UseStub=false — OTP login + status SMS will fail at runtime. Either set OSON_SMS_TOKEN or flip OSON_SMS_USE_STUB=true.");
        }

        WarnIfMissing(configuration, "Jura:BaseUrl",
          "JURA delivery integration disabled (live address search, delivery cost, courier tracking).", logger);

        WarnIfMissing(configuration, "DushanbeCityPayment:BaseUrl",
          "DushanbeCity payment URL is empty — checkout + prescription fee fall back to manual SuperAdmin confirmation.", logger);

        WarnIfMissing(configuration, "Elasticsearch:Url",
          "Elasticsearch URL is empty — medicine search runs in degraded mode (DB LIKE, no Elasticsearch reindex).", logger);

        logger.LogInformation("Environment validation passed.");
    }

    private static void Require(
      IConfiguration configuration,
      string key,
      List<string> failures,
      string hint)
    {
        if (string.IsNullOrWhiteSpace(configuration[key]))
            failures.Add($"{key} is missing — {hint}");
    }

    private static void WarnIfMissing(
      IConfiguration configuration,
      string key,
      string consequence,
      ILogger logger)
    {
        if (string.IsNullOrWhiteSpace(configuration[key]))
            logger.LogWarning("{Key} is empty. {Consequence}", key, consequence);
    }
}
