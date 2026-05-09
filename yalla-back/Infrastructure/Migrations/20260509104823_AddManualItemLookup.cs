using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddManualItemLookup : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "lookup_request_id",
                table: "prescription_checklist_items",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "is_catalog_medicine",
                table: "medicines",
                type: "boolean",
                nullable: false,
                defaultValue: true);

            migrationBuilder.AddColumn<Guid>(
                name: "manual_lookup_request_id",
                table: "medicines",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "manual_lookup_response_id",
                table: "medicines",
                type: "uuid",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "manual_item_lookup_requests",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    prescription_id = table.Column<Guid>(type: "uuid", nullable: false),
                    checklist_item_id = table.Column<Guid>(type: "uuid", nullable: false),
                    requested_by_pharmacist_id = table.Column<Guid>(type: "uuid", nullable: false),
                    manual_medicine_name = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    request_comment = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    status = table.Column<int>(type: "integer", nullable: false),
                    created_at_utc = table.Column<DateTime>(type: "timestamp", nullable: false),
                    closed_at_utc = table.Column<DateTime>(type: "timestamp", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_manual_item_lookup_requests", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "manual_item_lookup_responses",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    request_id = table.Column<Guid>(type: "uuid", nullable: false),
                    responding_pharmacy_id = table.Column<Guid>(type: "uuid", nullable: false),
                    responding_admin_id = table.Column<Guid>(type: "uuid", nullable: false),
                    full_name = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: false),
                    price = table.Column<decimal>(type: "numeric(18,2)", nullable: false),
                    quantity = table.Column<int>(type: "integer", nullable: false),
                    image_key = table.Column<string>(type: "character varying(1024)", maxLength: 1024, nullable: true),
                    response_comment = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    created_at_utc = table.Column<DateTime>(type: "timestamp", nullable: false),
                    updated_at_utc = table.Column<DateTime>(type: "timestamp", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_manual_item_lookup_responses", x => x.id);
                    table.ForeignKey(
                        name: "FK_manual_item_lookup_responses_manual_item_lookup_requests_re~",
                        column: x => x.request_id,
                        principalTable: "manual_item_lookup_requests",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "ix_prescription_checklist_items_lookup_request_id",
                table: "prescription_checklist_items",
                column: "lookup_request_id",
                unique: true,
                filter: "lookup_request_id IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "ix_medicines_manual_lookup_request_id",
                table: "medicines",
                column: "manual_lookup_request_id",
                filter: "manual_lookup_request_id IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "ix_medicines_manual_lookup_response_id",
                table: "medicines",
                column: "manual_lookup_response_id",
                unique: true,
                filter: "manual_lookup_response_id IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "ix_medicines_non_catalog",
                table: "medicines",
                column: "is_catalog_medicine",
                filter: "is_catalog_medicine = false");

            migrationBuilder.CreateIndex(
                name: "ix_manual_item_lookup_requests_active",
                table: "manual_item_lookup_requests",
                columns: new[] { "status", "created_at_utc" },
                filter: "status = 0");

            migrationBuilder.CreateIndex(
                name: "ix_manual_item_lookup_requests_checklist_item_id",
                table: "manual_item_lookup_requests",
                column: "checklist_item_id",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_manual_item_lookup_requests_prescription_id",
                table: "manual_item_lookup_requests",
                column: "prescription_id");

            migrationBuilder.CreateIndex(
                name: "ix_manual_item_lookup_requests_requested_by_pharmacist_id",
                table: "manual_item_lookup_requests",
                column: "requested_by_pharmacist_id");

            migrationBuilder.CreateIndex(
                name: "ix_manual_item_lookup_responses_request_pharmacy",
                table: "manual_item_lookup_responses",
                columns: new[] { "request_id", "responding_pharmacy_id" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "manual_item_lookup_responses");

            migrationBuilder.DropTable(
                name: "manual_item_lookup_requests");

            migrationBuilder.DropIndex(
                name: "ix_prescription_checklist_items_lookup_request_id",
                table: "prescription_checklist_items");

            migrationBuilder.DropIndex(
                name: "ix_medicines_manual_lookup_request_id",
                table: "medicines");

            migrationBuilder.DropIndex(
                name: "ix_medicines_manual_lookup_response_id",
                table: "medicines");

            migrationBuilder.DropIndex(
                name: "ix_medicines_non_catalog",
                table: "medicines");

            migrationBuilder.DropColumn(
                name: "lookup_request_id",
                table: "prescription_checklist_items");

            migrationBuilder.DropColumn(
                name: "is_catalog_medicine",
                table: "medicines");

            migrationBuilder.DropColumn(
                name: "manual_lookup_request_id",
                table: "medicines");

            migrationBuilder.DropColumn(
                name: "manual_lookup_response_id",
                table: "medicines");
        }
    }
}
