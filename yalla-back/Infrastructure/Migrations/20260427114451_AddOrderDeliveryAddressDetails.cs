using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddOrderDeliveryAddressDetails : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "apartment",
                table: "payment_intents",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "entrance",
                table: "payment_intents",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "floor",
                table: "payment_intents",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "apartment",
                table: "orders",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "entrance",
                table: "orders",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "floor",
                table: "orders",
                type: "integer",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "apartment",
                table: "payment_intents");

            migrationBuilder.DropColumn(
                name: "entrance",
                table: "payment_intents");

            migrationBuilder.DropColumn(
                name: "floor",
                table: "payment_intents");

            migrationBuilder.DropColumn(
                name: "apartment",
                table: "orders");

            migrationBuilder.DropColumn(
                name: "entrance",
                table: "orders");

            migrationBuilder.DropColumn(
                name: "floor",
                table: "orders");
        }
    }
}
