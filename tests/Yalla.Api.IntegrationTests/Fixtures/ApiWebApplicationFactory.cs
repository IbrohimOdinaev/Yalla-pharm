using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Yalla.Application;
using Yalla.Infrastructure;

namespace Yalla.Api.IntegrationTests.Fixtures;

public sealed class ApiWebApplicationFactory : WebApplicationFactory<Program>
{
    private readonly string _databaseName;

    public ApiWebApplicationFactory(string databaseName)
    {
        _databaseName = databaseName;
    }

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Development");

        builder.ConfigureAppConfiguration((_, configurationBuilder) =>
        {
            configurationBuilder.AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["ConnectionStrings:DefaultConnection"] = "Host=localhost;Database=inmemory;Username=inmemory;Password=inmemory"
            });
        });

        builder.ConfigureTestServices(services =>
        {
            services.RemoveAll<IDbContextOptionsConfiguration<YallaDbContext>>();
            services.RemoveAll<DbContextOptions<YallaDbContext>>();
            services.RemoveAll<YallaDbContext>();
            services.AddDbContext<YallaDbContext>(options =>
                options.UseInMemoryDatabase(_databaseName));

            services.RemoveAll<ITelegramService>();
            services.AddScoped<ITelegramService, NoOpTelegramService>();

            services.RemoveAll<IImageRepository>();
            services.AddScoped<IImageRepository, NoOpImageRepository>();

            services.RemoveAll<IDeliveryRepository>();
            services.AddScoped<IDeliveryRepository, NoOpDeliveryRepository>();
        });
    }
}
