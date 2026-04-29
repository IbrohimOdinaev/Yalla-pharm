using System.Text;
using System.Threading.RateLimiting;
using Api.Hubs;
using Api.Middleware;
using Api.Telegram;
using Api.Validation;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Http.Features;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.IdentityModel.Tokens;
using Serilog;
using Yalla.Application;
using Yalla.Application.Abstractions;
using Yalla.Application.Common;
using Yalla.Application.Services;
using Yalla.Infrastructure;
using Yalla.Infrastructure.Telegram;
using Microsoft.EntityFrameworkCore;

var builder = WebApplication.CreateBuilder(args);

builder.Host.UseSerilog((context, services, loggerConfiguration) =>
{
    loggerConfiguration
      .ReadFrom.Configuration(context.Configuration)
      .ReadFrom.Services(services)
      .Enrich.FromLogContext();
});

builder.Services.AddOpenApi();
builder.Services.AddControllers(options =>
{
    options.Filters.Add<ValidateRequestDtoFilter>();
});
builder.Services.Configure<ApiBehaviorOptions>(options =>
{
    options.InvalidModelStateResponseFactory = context =>
    {
        var modelState = context.ModelState
        .Where(entry => entry.Value is { Errors.Count: > 0 })
        .ToDictionary(
          entry => entry.Key,
          entry => entry.Value!.Errors
            .Select(error => string.IsNullOrWhiteSpace(error.ErrorMessage) ? "The input was not valid." : error.ErrorMessage)
            .Distinct(StringComparer.Ordinal)
            .ToArray(),
          StringComparer.OrdinalIgnoreCase);

        var problemDetails = new ValidationProblemDetails(modelState)
        {
            Status = StatusCodes.Status400BadRequest,
            Title = "Request validation failed."
        };

        return new BadRequestObjectResult(problemDetails);
    };
});
builder.Services.AddAuthorization();
var allowedOrigins = builder.Configuration.GetSection("Cors:AllowedOrigins").Get<string[]>()
  ?? ["http://localhost:3000"];
builder.Services.AddCors(options =>
{
    options.AddPolicy("FrontendCors", policy =>
    {
        policy.WithOrigins(allowedOrigins)
          .AllowAnyHeader()
          .AllowAnyMethod()
          .AllowCredentials();
    });
});
builder.Services.AddSignalR();
var smsVerificationSection = builder.Configuration.GetSection(SmsVerificationOptions.SectionName);
var requestRateLimitPerMinute = Math.Max(1, smsVerificationSection.GetValue<int?>("RequestRateLimitPerMinute") ?? 10);
var verifyRateLimitPerMinute = Math.Max(1, smsVerificationSection.GetValue<int?>("VerifyRateLimitPerMinute") ?? 30);
var resendRateLimitPerMinute = Math.Max(1, smsVerificationSection.GetValue<int?>("ResendRateLimitPerMinute") ?? 10);
builder.Services.AddRateLimiter(options =>
{
    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
    options.OnRejected = async (context, cancellationToken) =>
    {
        if (context.Lease.TryGetMetadata(MetadataName.RetryAfter, out var retryAfter))
            context.HttpContext.Response.Headers.RetryAfter = ((int)Math.Ceiling(retryAfter.TotalSeconds)).ToString();

        var problemDetails = new ProblemDetails
        {
            Status = StatusCodes.Status429TooManyRequests,
            Title = "Too Many Requests",
            Detail = "Слишком много запросов. Повторите немного позже."
        };

        problemDetails.Extensions["traceId"] = context.HttpContext.TraceIdentifier;
        problemDetails.Extensions["errorCode"] = "rate_limited";
        problemDetails.Extensions["reason"] = "rate_limit_exceeded";
        await context.HttpContext.Response.WriteAsJsonAsync(problemDetails, cancellationToken);
    };

    options.AddPolicy("sms-register-request", context =>
        RateLimitPartition.GetFixedWindowLimiter(
            partitionKey: BuildRateLimitPartitionKey(context, "sms-register-request"),
            factory: _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = requestRateLimitPerMinute,
                Window = TimeSpan.FromMinutes(1),
                QueueProcessingOrder = QueueProcessingOrder.OldestFirst,
                QueueLimit = 0,
                AutoReplenishment = true
            }));

    options.AddPolicy("sms-register-verify", context =>
        RateLimitPartition.GetFixedWindowLimiter(
            partitionKey: BuildRateLimitPartitionKey(context, "sms-register-verify"),
            factory: _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = verifyRateLimitPerMinute,
                Window = TimeSpan.FromMinutes(1),
                QueueProcessingOrder = QueueProcessingOrder.OldestFirst,
                QueueLimit = 0,
                AutoReplenishment = true
            }));

    options.AddPolicy("sms-register-resend", context =>
        RateLimitPartition.GetFixedWindowLimiter(
            partitionKey: BuildRateLimitPartitionKey(context, "sms-register-resend"),
            factory: _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = resendRateLimitPerMinute,
                Window = TimeSpan.FromMinutes(1),
                QueueProcessingOrder = QueueProcessingOrder.OldestFirst,
                QueueLimit = 0,
                AutoReplenishment = true
            }));
});
builder.Services.Configure<FormOptions>(options =>
{
    options.MultipartBodyLengthLimit = UserInputPolicy.MaxMedicineImageFileSizeBytes;
});

var jwtSection = builder.Configuration.GetSection("Jwt");
var jwtIssuer = jwtSection["Issuer"] ?? "Yalla.Api";
var jwtAudience = jwtSection["Audience"] ?? "Yalla.Api.Client";
var jwtKey = jwtSection["Key"] ?? throw new InvalidOperationException("Jwt:Key is missing in configuration.");

if (jwtKey.Length < 32)
    throw new InvalidOperationException("Jwt:Key must be at least 32 characters long.");

builder.Services
  .AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
  .AddJwtBearer(options =>
  {
      options.TokenValidationParameters = new TokenValidationParameters
      {
          ValidateIssuerSigningKey = true,
          IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtKey)),
          ValidateIssuer = true,
          ValidIssuer = jwtIssuer,
          ValidateAudience = true,
          ValidAudience = jwtAudience,
          ValidateLifetime = true,
          ClockSkew = TimeSpan.Zero
      };

      // Browsers cannot set custom headers on WebSocket upgrade requests, so
      // SignalR passes the JWT through the `access_token` query parameter.
      // Without this hook the middleware only reads from the `Authorization`
      // header and every WebSocket handshake returns 401.
      options.Events = new JwtBearerEvents
      {
          OnMessageReceived = context =>
          {
              var accessToken = context.Request.Query["access_token"];
              var path = context.HttpContext.Request.Path;
              if (!string.IsNullOrEmpty(accessToken) && path.StartsWithSegments("/hubs"))
              {
                  context.Token = accessToken;
              }
              return Task.CompletedTask;
          }
      };
  });

builder.Services.AddApplication();
builder.Services.AddInfrastructure(builder.Configuration);
builder.Services.AddScoped<IRealtimeUpdatesPublisher, SignalRRealtimeUpdatesPublisher>();

// Telegram bot deeplink auth
builder.Services.Configure<TelegramAuthOptions>(options =>
{
    var section = builder.Configuration.GetSection(TelegramAuthOptions.SectionName);
    options.BotToken = section["BotToken"] ?? string.Empty;
    options.BotUsername = section["BotUsername"] ?? string.Empty;
    options.WebhookPublicBaseUrl = section["WebhookPublicBaseUrl"] ?? string.Empty;
    options.WebhookSecretToken = section["WebhookSecretToken"] ?? string.Empty;
    if (int.TryParse(section["AuthSessionTtlSeconds"], out var ttl) && ttl > 0)
        options.AuthSessionTtlSeconds = ttl;
    if (bool.TryParse(section["AutoRegisterWebhookOnStart"], out var autoRegister))
        options.AutoRegisterWebhookOnStart = autoRegister;
});
builder.Services.AddHttpClient<ITelegramBotApi, TelegramBotApi>();
builder.Services.AddScoped<ITelegramAuthService, TelegramAuthService>();
builder.Services.AddScoped<ITelegramAuthRealtimePublisher, SignalRTelegramAuthRealtimePublisher>();
builder.Services.AddScoped<TelegramBotUpdateHandler>();
builder.Services.AddHostedService<TelegramAuthSessionCleanupHostedService>();

var app = builder.Build();

var applyMigrationsOnStartup = app.Configuration.GetValue<bool>("Database:ApplyMigrationsOnStartup");
if (applyMigrationsOnStartup)
{
    using var scope = app.Services.CreateScope();
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    var logger = scope.ServiceProvider.GetRequiredService<ILogger<Program>>();
    var applied = (await db.Database.GetAppliedMigrationsAsync()).ToArray();
    var pending = (await db.Database.GetPendingMigrationsAsync()).ToArray();
    logger.LogInformation("EF migrations: {AppliedCount} applied, {PendingCount} pending. Pending: {Pending}",
        applied.Length, pending.Length, pending.Length == 0 ? "(none)" : string.Join(", ", pending));
    await db.Database.MigrateAsync();
    logger.LogInformation("EF migrations applied successfully.");

    // One-shot WooCommerce slug backfill: when the AddMedicineSlug migration
    // first runs, the slug column is NULL for every existing medicine. Detect
    // that condition and pull slugs from WC right after migrations so SEO
    // routes work on first deploy without an admin manually triggering the
    // POST /api/medicines/backfill-from-woocommerce endpoint. Self-clearing —
    // subsequent restarts find no NULL+WcId rows and skip the network call.
    var needsBackfill = await db.Set<Yalla.Domain.Entities.Medicine>()
        .AnyAsync(m => m.WooCommerceId != null && m.Slug == null);
    if (needsBackfill)
    {
        // Fire-and-forget: a 5800-product sweep takes minutes and would block
        // the health check otherwise. The service runs to completion in the
        // background; failures are already logged inside BackfillCatalogAsync.
        // Capture the IServiceProvider so we get a fresh DI scope (the outer
        // `scope` is disposed when this block exits).
        var rootProvider = app.Services;
        _ = Task.Run(async () =>
        {
            using var bgScope = rootProvider.CreateScope();
            var bgLogger = bgScope.ServiceProvider.GetRequiredService<ILogger<Program>>();
            var bgSync = bgScope.ServiceProvider.GetRequiredService<Yalla.Application.Services.IWooCommerceSyncService>();
            try
            {
                var synced = await bgSync.BackfillCatalogAsync();
                bgLogger.LogInformation("Startup WC backfill: {Count} medicines acquired slug", synced);
            }
            catch (Exception ex)
            {
                bgLogger.LogError(ex, "Startup WC backfill failed; admin can retry via the /api/medicines/backfill-from-woocommerce endpoint");
            }
        });
        logger.LogInformation("Startup WC backfill kicked off in background");
    }
}

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

// Old embedded frontend disabled — using separate Next.js frontend (yalla-farm-front)
// app.UseDefaultFiles();
// app.UseStaticFiles();
app.UseSerilogRequestLogging();
app.UseMiddleware<ExceptionHandlingMiddleware>();
app.UseHttpsRedirection();
app.UseRouting();
app.UseCors("FrontendCors");
app.UseRateLimiter();
app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();
app.MapHub<UpdatesHub>("/hubs/updates");
app.MapHub<TelegramAuthHub>("/hubs/telegram-auth");
// app.MapFallbackToFile("index.html");

app.Run();

static string BuildRateLimitPartitionKey(HttpContext context, string policyName)
{
    var hostEnvironment = context.RequestServices.GetService<IHostEnvironment>();
    if (hostEnvironment?.IsEnvironment("IntegrationTests") == true)
        return $"{policyName}:integration-tests";

    var ip = context.Connection.RemoteIpAddress?.ToString() ?? "unknown-ip";
    return $"{policyName}:{ip}";
}

public partial class Program { }
