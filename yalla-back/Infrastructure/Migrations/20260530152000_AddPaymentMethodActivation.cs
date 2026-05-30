using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using Yalla.Infrastructure;

#nullable disable

namespace Infrastructure.Migrations
{
    /// <inheritdoc />
    [DbContext(typeof(AppDbContext))]
    [Migration("20260530152000_AddPaymentMethodActivation")]
    public partial class AddPaymentMethodActivation : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "is_alif_enabled",
                table: "payment_settings",
                type: "boolean",
                nullable: false,
                defaultValue: true);

            migrationBuilder.AddColumn<bool>(
                name: "is_dc_enabled",
                table: "payment_settings",
                type: "boolean",
                nullable: false,
                defaultValue: true);

            migrationBuilder.AddColumn<bool>(
                name: "is_eskhata_enabled",
                table: "payment_settings",
                type: "boolean",
                nullable: false,
                defaultValue: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "is_alif_enabled",
                table: "payment_settings");

            migrationBuilder.DropColumn(
                name: "is_dc_enabled",
                table: "payment_settings");

            migrationBuilder.DropColumn(
                name: "is_eskhata_enabled",
                table: "payment_settings");
        }
    }
}
