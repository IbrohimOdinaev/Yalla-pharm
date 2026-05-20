using System;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using Yalla.Infrastructure;

#nullable disable

namespace Infrastructure.Migrations
{
    [DbContext(typeof(AppDbContext))]
    [Migration("20260519133000_AddHomePopularMedicines")]
    public partial class AddHomePopularMedicines : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "home_popular_medicines",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    medicine_id = table.Column<Guid>(type: "uuid", nullable: false),
                    position = table.Column<int>(type: "integer", nullable: false),
                    created_at_utc = table.Column<DateTime>(type: "timestamp without time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_home_popular_medicines", x => x.id);
                    table.ForeignKey(
                        name: "FK_home_popular_medicines_medicines_medicine_id",
                        column: x => x.medicine_id,
                        principalTable: "medicines",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "ux_home_popular_medicines_medicine_id",
                table: "home_popular_medicines",
                column: "medicine_id",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ux_home_popular_medicines_position",
                table: "home_popular_medicines",
                column: "position",
                unique: true);

            migrationBuilder.Sql(@"
                INSERT INTO home_popular_medicines (id, medicine_id, position, created_at_utc)
                SELECT seed.id, seed.id, seed.position, (NOW() AT TIME ZONE 'UTC')
                FROM (
                    SELECT m.id,
                           ROW_NUMBER() OVER (
                             ORDER BY EXISTS (
                               SELECT 1 FROM medicine_images mi
                               WHERE mi.medicine_id = m.id AND mi.key NOT LIKE '%placeholder%'
                             ) DESC, m.title, m.articul
                           )::integer AS position
                    FROM medicines m
                    WHERE m.is_active = TRUE
                      AND m.is_catalog_medicine = TRUE
                      AND EXISTS (
                        SELECT 1 FROM offers o
                        WHERE o.medicine_id = m.id AND o.stock_quantity > 0
                      )
                    ORDER BY EXISTS (
                      SELECT 1 FROM medicine_images mi
                      WHERE mi.medicine_id = m.id AND mi.key NOT LIKE '%placeholder%'
                    ) DESC, m.title, m.articul
                    LIMIT 10
                ) seed;");
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(name: "home_popular_medicines");
        }
    }
}
