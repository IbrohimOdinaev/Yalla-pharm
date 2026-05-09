using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class DropChecklistItemIdFromManualLookup : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "ix_manual_item_lookup_requests_checklist_item_id",
                table: "manual_item_lookup_requests");

            migrationBuilder.DropColumn(
                name: "checklist_item_id",
                table: "manual_item_lookup_requests");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "checklist_item_id",
                table: "manual_item_lookup_requests",
                type: "uuid",
                nullable: false,
                defaultValue: new Guid("00000000-0000-0000-0000-000000000000"));

            migrationBuilder.CreateIndex(
                name: "ix_manual_item_lookup_requests_checklist_item_id",
                table: "manual_item_lookup_requests",
                column: "checklist_item_id",
                unique: true);
        }
    }
}
