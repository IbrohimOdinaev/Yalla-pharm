using System.Security.Claims;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;

namespace Yalla.Presentation.Tests.Helpers;

internal sealed class ApiWebApplicationFactory : WebApplicationFactory<Program>
{
    private readonly ClaimsPrincipal? _principal;
    private readonly Action<IServiceCollection>? _configureServices;

    public ApiWebApplicationFactory(
        ClaimsPrincipal? principal = null,
        Action<IServiceCollection>? configureServices = null)
    {
        _principal = principal;
        _configureServices = configureServices;
    }

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.ConfigureTestServices(services =>
        {
            services.RemoveAll<IOrderService>();
            services.RemoveAll<IPharmacyOrderService>();
            services.RemoveAll<ITelegramService>();

            Mock<IOrderService> orderServiceMock = new();
            orderServiceMock.Setup(x => x.GetOrderNumber(It.IsAny<string>())).Returns("N-1");
            orderServiceMock.Setup(x => x.DeleteAsync(It.IsAny<string>(), It.IsAny<CancellationToken>())).ReturnsAsync(true);
            services.AddSingleton(orderServiceMock.Object);

            Mock<IPharmacyOrderService> pharmacyOrderServiceMock = new();
            pharmacyOrderServiceMock
                .Setup(x => x.GetByOrderId(It.IsAny<string>(), It.IsAny<CancellationToken>()))
                .Returns(System.Linq.AsyncEnumerable.ToAsyncEnumerable(Array.Empty<PharmacyOrderResponse>()));
            services.AddSingleton(pharmacyOrderServiceMock.Object);

            Mock<ITelegramService> telegramServiceMock = new();
            services.AddSingleton(telegramServiceMock.Object);

            if (_principal is not null)
            {
                services.AddSingleton(new TestAuthState
                {
                    Principal = _principal,
                });

                services.AddAuthentication(options =>
                {
                    options.DefaultAuthenticateScheme = TestAuthHandler.SchemeName;
                    options.DefaultChallengeScheme = TestAuthHandler.SchemeName;
                }).AddScheme<AuthenticationSchemeOptions, TestAuthHandler>(TestAuthHandler.SchemeName, _ => { });
            }

            _configureServices?.Invoke(services);
        });
    }

    public static ClaimsPrincipal CreatePrincipal(string role)
    {
        Claim[] claims =
        {
            new(ClaimTypes.Name, "test-user"),
            new(ClaimTypes.Role, role),
        };

        ClaimsIdentity identity = new(claims, TestAuthHandler.SchemeName);
        return new ClaimsPrincipal(identity);
    }

    public static ClaimsPrincipal CreatePrincipal(params string[] roles)
    {
        List<Claim> claims = new()
        {
            new Claim(ClaimTypes.Name, "test-user"),
        };

        claims.AddRange(roles.Select(role => new Claim(ClaimTypes.Role, role)));
        ClaimsIdentity identity = new(claims, TestAuthHandler.SchemeName);
        return new ClaimsPrincipal(identity);
    }
}
