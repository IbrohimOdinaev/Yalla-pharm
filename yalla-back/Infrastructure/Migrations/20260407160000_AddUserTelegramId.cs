using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using Yalla.Infrastructure;

#nullable disable

namespace Infrastructure.Migrations
{
    /// <inheritdoc />
    [DbContext(typeof(AppDbContext))]
    [Migration("20260407160000_AddUserTelegramId")]
    public partial class AddUserTelegramId : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Idempotent: this migration's [Migration] attribute was wired up
            // late (hotfix 5a21549), so on environments where the column was
            // already added by an earlier build but the history row was never
            // recorded, a plain ALTER would crash with 42701 ("column already
            // exists"). IF NOT EXISTS lets EF replay the migration — its only
            // job here is to insert the __EFMigrationsHistory row.
            migrationBuilder.Sql(
                "ALTER TABLE users ADD COLUMN IF NOT EXISTS telegram_id bigint;");

            migrationBuilder.Sql(
                "CREATE UNIQUE INDEX IF NOT EXISTS ix_users_telegram_id " +
                "ON users (telegram_id) WHERE telegram_id IS NOT NULL;");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "ix_users_telegram_id",
                table: "users");

            migrationBuilder.DropColumn(
                name: "telegram_id",
                table: "users");
        }
    }
}
