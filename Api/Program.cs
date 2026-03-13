using System.Text;
using Api.Middleware;
using Api.Validation;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Http.Features;
using Microsoft.AspNetCore.Mvc;
using Microsoft.IdentityModel.Tokens;
using Serilog;
using Yalla.Application;
using Yalla.Application.Common;
using Yalla.Infrastructure;
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
  });

builder.Services.AddApplication();
builder.Services.AddInfrastructure(builder.Configuration);

var app = builder.Build();

var applyMigrationsOnStartup = app.Configuration.GetValue<bool>("Database:ApplyMigrationsOnStartup");
if (applyMigrationsOnStartup)
{
    using var scope = app.Services.CreateScope();
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    db.Database.Migrate();
}

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

app.UseDefaultFiles();
app.UseStaticFiles();
app.UseSerilogRequestLogging();
app.UseMiddleware<ExceptionHandlingMiddleware>();
app.UseHttpsRedirection();
app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();
app.MapFallbackToFile("index.html");

app.Run();

public partial class Program { }
