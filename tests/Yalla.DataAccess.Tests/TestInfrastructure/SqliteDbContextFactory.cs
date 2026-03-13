using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;

namespace Yalla.DataAccess.Tests.TestInfrastructure;

internal static class SqliteDbContextFactory
{
    public static (YallaDbContext Context, SqliteConnection Connection) Create()
    {
        SqliteConnection connection = new("DataSource=:memory:");
        connection.Open();

        DbContextOptions<YallaDbContext> options = new DbContextOptionsBuilder<YallaDbContext>()
            .UseSqlite(connection)
            .Options;

        YallaDbContext context = new(options);
        context.Database.EnsureCreated();
        return (context, connection);
    }
}
