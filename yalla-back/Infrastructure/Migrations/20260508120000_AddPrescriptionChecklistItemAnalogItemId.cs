using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using Yalla.Infrastructure;

#nullable disable

namespace Infrastructure.Migrations
{
    /// <inheritdoc />
    [DbContext(typeof(AppDbContext))]
    [Migration("20260508120000_AddPrescriptionChecklistItemAnalogItemId")]
    public partial class AddPrescriptionChecklistItemAnalogItemId : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Idempotent: the column gets added by the next deploy and the
            // older catalog-pick analog field stays in place untouched. Wrap
            // each step in IF NOT EXISTS so a partially-applied / replayed
            // migration doesn't trip 42701 the way AddUserTelegramId did.
            migrationBuilder.Sql(
                "ALTER TABLE prescription_checklist_items " +
                "ADD COLUMN IF NOT EXISTS analog_item_id uuid;");

            migrationBuilder.Sql(
                "CREATE INDEX IF NOT EXISTS ix_prescription_checklist_items_analog_item_id " +
                "ON prescription_checklist_items (analog_item_id) " +
                "WHERE analog_item_id IS NOT NULL;");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "ix_prescription_checklist_items_analog_item_id",
                table: "prescription_checklist_items");

            migrationBuilder.DropColumn(
                name: "analog_item_id",
                table: "prescription_checklist_items");
        }
    }
}
