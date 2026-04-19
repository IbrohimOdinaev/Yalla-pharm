using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using Yalla.Infrastructure;

#nullable disable

namespace Yalla.Infrastructure.Migrations
{
    [DbContext(typeof(AppDbContext))]
    [Migration("20260419103000_AddSyncState")]
    public partial class AddSyncState : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "sync_state",
                columns: table => new
                {
                    key = table.Column<string>(
                        type: "character varying(64)",
                        maxLength: 64,
                        nullable: false),
                    value = table.Column<string>(
                        type: "text",
                        nullable: false),
                    updated_at_utc = table.Column<System.DateTime>(
                        type: "timestamp without time zone",
                        nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_sync_state", x => x.key);
                });
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(name: "sync_state");
        }
    }
}
