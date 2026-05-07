using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using Yalla.Infrastructure;

#nullable disable

namespace Infrastructure.Migrations
{
    /// <inheritdoc />
    [DbContext(typeof(AppDbContext))]
    [Migration("20260507180000_AddPrescriptionTierAndChecklistKind")]
    public partial class AddPrescriptionTierAndChecklistKind : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Client's tier choice — 0 = AsPrescribed (default for legacy
            // rows), 1 = GoldenMiddle, 2 = MaxSavings.
            migrationBuilder.AddColumn<int>(
                name: "preference_tier",
                table: "prescriptions",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            // Pharmacist's per-item verdict — 0 = Original (legacy default),
            // 1 = Undecoded.
            migrationBuilder.AddColumn<int>(
                name: "kind",
                table: "prescription_checklist_items",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            // Optional cheaper substitute the pharmacist recommends for an
            // Original-kind item. Filtered partial index — only rows that
            // actually carry an analog get indexed (most won't).
            migrationBuilder.AddColumn<System.Guid>(
                name: "analog_medicine_id",
                table: "prescription_checklist_items",
                type: "uuid",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "ix_prescription_checklist_items_analog_medicine_id",
                table: "prescription_checklist_items",
                column: "analog_medicine_id",
                filter: "analog_medicine_id IS NOT NULL");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "ix_prescription_checklist_items_analog_medicine_id",
                table: "prescription_checklist_items");

            migrationBuilder.DropColumn(
                name: "analog_medicine_id",
                table: "prescription_checklist_items");

            migrationBuilder.DropColumn(
                name: "kind",
                table: "prescription_checklist_items");

            migrationBuilder.DropColumn(
                name: "preference_tier",
                table: "prescriptions");
        }
    }
}
