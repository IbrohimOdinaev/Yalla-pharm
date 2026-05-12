using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddDecodeFailureAndPendingRefund : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "has_free_prescription_credit",
                table: "users",
                type: "boolean",
                nullable: true,
                defaultValue: false);

            migrationBuilder.AddColumn<DateTime>(
                name: "decode_failed_at_utc",
                table: "prescriptions",
                type: "timestamp",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "decode_failed_by_pharmacist_id",
                table: "prescriptions",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "decode_failure_comment",
                table: "prescriptions",
                type: "character varying(2000)",
                maxLength: 2000,
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "decode_failure_reason",
                table: "prescriptions",
                type: "integer",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "pending_refunds",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    client_id = table.Column<Guid>(type: "uuid", nullable: false),
                    prescription_id = table.Column<Guid>(type: "uuid", nullable: false),
                    amount = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    currency = table.Column<string>(type: "character varying(8)", maxLength: 8, nullable: false),
                    reason = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false),
                    created_at_utc = table.Column<DateTime>(type: "timestamp", nullable: false),
                    processed_at_utc = table.Column<DateTime>(type: "timestamp", nullable: true),
                    processed_by_user_id = table.Column<Guid>(type: "uuid", nullable: true),
                    super_admin_comment = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_pending_refunds", x => x.id);
                });

            migrationBuilder.CreateIndex(
                name: "ix_pending_refunds_client_id",
                table: "pending_refunds",
                column: "client_id");

            migrationBuilder.CreateIndex(
                name: "ix_pending_refunds_prescription_id",
                table: "pending_refunds",
                column: "prescription_id");

            migrationBuilder.CreateIndex(
                name: "ix_pending_refunds_unprocessed",
                table: "pending_refunds",
                column: "processed_at_utc",
                filter: "processed_at_utc IS NULL");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "pending_refunds");

            migrationBuilder.DropColumn(
                name: "has_free_prescription_credit",
                table: "users");

            migrationBuilder.DropColumn(
                name: "decode_failed_at_utc",
                table: "prescriptions");

            migrationBuilder.DropColumn(
                name: "decode_failed_by_pharmacist_id",
                table: "prescriptions");

            migrationBuilder.DropColumn(
                name: "decode_failure_comment",
                table: "prescriptions");

            migrationBuilder.DropColumn(
                name: "decode_failure_reason",
                table: "prescriptions");
        }
    }
}
