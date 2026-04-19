using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Yalla.Infrastructure;

#nullable disable

namespace Yalla.Infrastructure.Migrations
{
    [DbContext(typeof(AppDbContext))]
    [Migration("20260418100000_AddPaymentSettings")]
    public partial class AddPaymentSettings : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "payment_settings",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    dc_base_url = table.Column<string>(type: "character varying(2048)", maxLength: 2048, nullable: true),
                    updated_at_utc = table.Column<DateTime>(type: "timestamp without time zone", nullable: false),
                    updated_by_user_id = table.Column<Guid>(type: "uuid", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_payment_settings", x => x.id);
                });

            // Seed singleton row via raw SQL (InsertData requires a Designer model snapshot).
            migrationBuilder.Sql(@"
                INSERT INTO payment_settings (id, dc_base_url, updated_at_utc, updated_by_user_id)
                VALUES ('00000000-0000-0000-0000-000000000001', NULL, now() AT TIME ZONE 'utc', NULL)
                ON CONFLICT (id) DO NOTHING;
            ");
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(name: "payment_settings");
        }
    }
}
