using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Yalla.Application.Abstractions;

namespace Yalla.Infrastructure;

public static class DependencyInjection
{
  public static IServiceCollection AddInfrastructure(this IServiceCollection services, IConfiguration config)
  {
    var connectionString = config.GetConnectionString("Default");

    services.AddDbContext<AppDbContext>(options =>
        options.UseNpgsql(connectionString));

    services.AddScoped<IAppDbContext>(provider => provider.GetRequiredService<AppDbContext>());

    return services;
  }
}
