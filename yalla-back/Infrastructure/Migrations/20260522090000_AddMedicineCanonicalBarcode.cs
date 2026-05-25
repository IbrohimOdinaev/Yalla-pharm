using Microsoft.EntityFrameworkCore.Migrations;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Yalla.Infrastructure;

#nullable disable

namespace Infrastructure.Migrations
{
    [DbContext(typeof(AppDbContext))]
    [Migration("20260522090000_AddMedicineCanonicalBarcode")]
    public partial class AddMedicineCanonicalBarcode : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "barcode",
                table: "medicines",
                type: "character varying(64)",
                maxLength: 64,
                nullable: true);

            migrationBuilder.DropIndex(
                name: "ix_medicine_barcodes_barcode",
                table: "medicine_barcodes");

            migrationBuilder.CreateIndex(
                name: "ux_medicines_barcode",
                table: "medicines",
                column: "barcode",
                unique: true,
                filter: "barcode IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "ux_medicine_barcodes_barcode",
                table: "medicine_barcodes",
                column: "barcode",
                unique: true);
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "ux_medicines_barcode",
                table: "medicines");

            migrationBuilder.DropIndex(
                name: "ux_medicine_barcodes_barcode",
                table: "medicine_barcodes");

            migrationBuilder.DropColumn(
                name: "barcode",
                table: "medicines");

            migrationBuilder.CreateIndex(
                name: "ix_medicine_barcodes_barcode",
                table: "medicine_barcodes",
                column: "barcode");
        }
    }
}
