using Microsoft.EntityFrameworkCore;
using Npgsql;
using Respawn;
using Testcontainers.PostgreSql;
using Yalla.Infrastructure;
using Yalla.Api.IntegrationTests.TestData;

namespace Yalla.Api.IntegrationTests.Fixtures;

public sealed class IntegrationTestFixture : IAsyncLifetime
{
    private readonly PostgreSqlContainer _postgres;
    private Respawner _respawner = null!;

    public ApiWebApplicationFactory Factory { get; private set; } = null!;

    public string ConnectionString => _postgres.GetConnectionString();

    public IntegrationTestFixture()
    {
        _postgres = new PostgreSqlBuilder()
            .WithImage("postgres:16-alpine")
            .WithDatabase("yalla_integration_tests")
            .WithUsername("postgres")
            .WithPassword("postgres")
            .WithCleanUp(true)
            .Build();
    }

    public async Task InitializeAsync()
    {
        await _postgres.StartAsync();
        await ApplyMigrationsAsync();
        await InitializeRespawnerAsync();

        Factory = new ApiWebApplicationFactory(ConnectionString);
        await ResetDatabaseAsync();
    }

    public async Task DisposeAsync()
    {
        if (Factory is not null)
            await Factory.DisposeAsync();

        await _postgres.DisposeAsync();
    }

    public async Task ResetDatabaseAsync()
    {
        await using NpgsqlConnection connection = new(ConnectionString);
        await connection.OpenAsync();

        await _respawner.ResetAsync(connection);
        await TestDataSeeder.SeedAsync(connection);
    }

    public HttpClient CreateClient()
        => Factory.CreateClient(new WebApplicationFactoryClientOptions
        {
            AllowAutoRedirect = false
        });

    public HttpClient CreateAuthenticatedClient(params string[] roles)
    {
        HttpClient client = CreateClient();
        string token = JwtTokenFactory.CreateToken(roles);
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);
        return client;
    }

    private async Task ApplyMigrationsAsync()
    {
        DbContextOptions<YallaDbContext> dbContextOptions = new DbContextOptionsBuilder<YallaDbContext>()
            .UseNpgsql(ConnectionString)
            .Options;

        await using YallaDbContext dbContext = new(dbContextOptions);
        await dbContext.Database.MigrateAsync();
    }

    private async Task InitializeRespawnerAsync()
    {
        await using NpgsqlConnection connection = new(ConnectionString);
        await connection.OpenAsync();

        _respawner = await Respawner.CreateAsync(connection, new RespawnerOptions
        {
            DbAdapter = DbAdapter.Postgres,
            SchemasToInclude = ["public"],
            TablesToIgnore = [new Respawn.Graph.Table("__EFMigrationsHistory")]
        });
    }
}
