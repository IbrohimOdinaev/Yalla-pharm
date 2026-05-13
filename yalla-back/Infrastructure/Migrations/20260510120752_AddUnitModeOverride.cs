using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddUnitModeOverride : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "unit_count",
                table: "prescription_checklist_items",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "unit_total_price",
                table: "prescription_checklist_items",
                type: "numeric(18,2)",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "use_unit_mode",
                table: "prescription_checklist_items",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<int>(
                name: "unit_count",
                table: "order_positions",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "unit_total_price",
                table: "order_positions",
                type: "numeric(18,2)",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "use_unit_mode",
                table: "order_positions",
                type: "boolean",
                nullable: false,
                defaultValue: false);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "unit_count",
                table: "prescription_checklist_items");

            migrationBuilder.DropColumn(
                name: "unit_total_price",
                table: "prescription_checklist_items");

            migrationBuilder.DropColumn(
                name: "use_unit_mode",
                table: "prescription_checklist_items");

            migrationBuilder.DropColumn(
                name: "unit_count",
                table: "order_positions");

            migrationBuilder.DropColumn(
                name: "unit_total_price",
                table: "order_positions");

            migrationBuilder.DropColumn(
                name: "use_unit_mode",
                table: "order_positions");
        }
    }
}
