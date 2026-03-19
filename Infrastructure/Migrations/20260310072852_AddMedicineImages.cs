using System;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using Yalla.Infrastructure;

#nullable disable

namespace Infrastructure.Migrations
{
    /// <inheritdoc />
    [DbContext(typeof(AppDbContext))]
    [Migration("20260310072852_AddMedicineImages")]
    public partial class AddMedicineImages : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "url",
                table: "medicines");

            migrationBuilder.CreateTable(
                name: "medicine_images",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    key = table.Column<string>(type: "character varying(1024)", maxLength: 1024, nullable: false),
                    is_main = table.Column<bool>(type: "boolean", nullable: false),
                    is_minimal = table.Column<bool>(type: "boolean", nullable: false),
                    medicine_id = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_medicine_images", x => x.id);
                    table.ForeignKey(
                        name: "FK_medicine_images_medicines_medicine_id",
                        column: x => x.medicine_id,
                        principalTable: "medicines",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "ux_medicine_images_medicine_main",
                table: "medicine_images",
                columns: new[] { "medicine_id", "is_main" },
                unique: true,
                filter: "is_main");

            migrationBuilder.CreateIndex(
                name: "ux_medicine_images_medicine_minimal",
                table: "medicine_images",
                columns: new[] { "medicine_id", "is_minimal" },
                unique: true,
                filter: "is_minimal");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "medicine_images");

            migrationBuilder.AddColumn<string>(
                name: "url",
                table: "medicines",
                type: "character varying(1024)",
                maxLength: 1024,
                nullable: true);
        }
    }
}
