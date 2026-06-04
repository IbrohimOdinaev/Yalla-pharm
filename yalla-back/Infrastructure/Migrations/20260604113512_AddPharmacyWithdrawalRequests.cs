using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddPharmacyWithdrawalRequests : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "pharmacy_withdrawal_requests",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    pharmacy_id = table.Column<Guid>(type: "uuid", nullable: false),
                    requested_by_admin_id = table.Column<Guid>(type: "uuid", nullable: false),
                    amount = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    currency = table.Column<string>(type: "character varying(8)", maxLength: 8, nullable: false),
                    bank = table.Column<int>(type: "integer", nullable: false, defaultValue: 0),
                    wallet_phone_number = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    deep_link_url = table.Column<string>(type: "character varying(2048)", maxLength: 2048, nullable: false),
                    status = table.Column<int>(type: "integer", nullable: false, defaultValue: 0),
                    created_at_utc = table.Column<DateTime>(type: "timestamp without time zone", nullable: false),
                    completed_at_utc = table.Column<DateTime>(type: "timestamp without time zone", nullable: true),
                    completed_by_super_admin_id = table.Column<Guid>(type: "uuid", nullable: true),
                    receipt_image_key = table.Column<string>(type: "character varying(512)", maxLength: 512, nullable: true),
                    super_admin_comment = table.Column<string>(type: "character varying(512)", maxLength: 512, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_pharmacy_withdrawal_requests", x => x.id);
                    table.ForeignKey(
                        name: "FK_pharmacy_withdrawal_requests_pharmacies_pharmacy_id",
                        column: x => x.pharmacy_id,
                        principalTable: "pharmacies",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_pharmacy_withdrawal_requests_users_completed_by_super_admin~",
                        column: x => x.completed_by_super_admin_id,
                        principalTable: "users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_pharmacy_withdrawal_requests_users_requested_by_admin_id",
                        column: x => x.requested_by_admin_id,
                        principalTable: "users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_pharmacy_withdrawal_requests_completed_by_super_admin_id",
                table: "pharmacy_withdrawal_requests",
                column: "completed_by_super_admin_id");

            migrationBuilder.CreateIndex(
                name: "ix_pharmacy_withdrawal_requests_pharmacy_status",
                table: "pharmacy_withdrawal_requests",
                columns: new[] { "pharmacy_id", "status" });

            migrationBuilder.CreateIndex(
                name: "IX_pharmacy_withdrawal_requests_requested_by_admin_id",
                table: "pharmacy_withdrawal_requests",
                column: "requested_by_admin_id");

            migrationBuilder.CreateIndex(
                name: "ix_pharmacy_withdrawal_requests_status_created_at",
                table: "pharmacy_withdrawal_requests",
                columns: new[] { "status", "created_at_utc" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "pharmacy_withdrawal_requests");
        }
    }
}
