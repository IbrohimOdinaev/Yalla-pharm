using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddMedicineId1C : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "id_1c",
                table: "medicines",
                type: "uuid",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "ix_medicines_id_1c",
                table: "medicines",
                column: "id_1c",
                unique: true,
                filter: "id_1c IS NOT NULL");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "ix_medicines_id_1c",
                table: "medicines");

            migrationBuilder.DropColumn(
                name: "id_1c",
                table: "medicines");
        }
    }
}
