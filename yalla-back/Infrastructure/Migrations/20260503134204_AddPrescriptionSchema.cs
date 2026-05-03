using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddPrescriptionSchema : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "prescriptions",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    client_id = table.Column<Guid>(type: "uuid", nullable: false),
                    patient_age = table.Column<int>(type: "integer", nullable: false),
                    client_comment = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    status = table.Column<int>(type: "integer", nullable: false),
                    assigned_pharmacist_id = table.Column<Guid>(type: "uuid", nullable: true),
                    decoded_at_utc = table.Column<DateTime>(type: "timestamp", nullable: true),
                    pharmacist_overall_comment = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
                    payment_intent_id = table.Column<Guid>(type: "uuid", nullable: true),
                    order_id = table.Column<Guid>(type: "uuid", nullable: true),
                    created_at_utc = table.Column<DateTime>(type: "timestamp", nullable: false),
                    updated_at_utc = table.Column<DateTime>(type: "timestamp", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_prescriptions", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "prescription_checklist_items",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    prescription_id = table.Column<Guid>(type: "uuid", nullable: false),
                    medicine_id = table.Column<Guid>(type: "uuid", nullable: true),
                    manual_medicine_name = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    quantity = table.Column<int>(type: "integer", nullable: false),
                    pharmacist_comment = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    created_at_utc = table.Column<DateTime>(type: "timestamp", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_prescription_checklist_items", x => x.id);
                    table.ForeignKey(
                        name: "FK_prescription_checklist_items_prescriptions_prescription_id",
                        column: x => x.prescription_id,
                        principalTable: "prescriptions",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "prescription_images",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    prescription_id = table.Column<Guid>(type: "uuid", nullable: false),
                    key = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false),
                    order_index = table.Column<int>(type: "integer", nullable: false),
                    created_at_utc = table.Column<DateTime>(type: "timestamp", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_prescription_images", x => x.id);
                    table.ForeignKey(
                        name: "FK_prescription_images_prescriptions_prescription_id",
                        column: x => x.prescription_id,
                        principalTable: "prescriptions",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "ix_prescription_checklist_items_medicine_id",
                table: "prescription_checklist_items",
                column: "medicine_id",
                filter: "medicine_id IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "ix_prescription_checklist_items_prescription_id",
                table: "prescription_checklist_items",
                column: "prescription_id");

            migrationBuilder.CreateIndex(
                name: "ix_prescription_images_prescription_id",
                table: "prescription_images",
                column: "prescription_id");

            migrationBuilder.CreateIndex(
                name: "ux_prescription_images_prescription_id_order_index",
                table: "prescription_images",
                columns: new[] { "prescription_id", "order_index" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_prescriptions_assigned_pharmacist_id",
                table: "prescriptions",
                column: "assigned_pharmacist_id",
                filter: "assigned_pharmacist_id IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "ix_prescriptions_client_id",
                table: "prescriptions",
                column: "client_id");

            migrationBuilder.CreateIndex(
                name: "ix_prescriptions_status",
                table: "prescriptions",
                column: "status");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "prescription_checklist_items");

            migrationBuilder.DropTable(
                name: "prescription_images");

            migrationBuilder.DropTable(
                name: "prescriptions");
        }
    }
}
