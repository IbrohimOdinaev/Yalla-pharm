using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddStaffCompensationPayoutRequests : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "staff_compensation_payout_requests",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    staff_user_id = table.Column<Guid>(type: "uuid", nullable: false),
                    staff_role = table.Column<int>(type: "integer", nullable: false),
                    amount = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    currency = table.Column<string>(type: "character varying(8)", maxLength: 8, nullable: false),
                    bank = table.Column<int>(type: "integer", nullable: false, defaultValue: 0),
                    wallet_phone_number = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    deep_link_url = table.Column<string>(type: "character varying(2048)", maxLength: 2048, nullable: false),
                    status = table.Column<int>(type: "integer", nullable: false, defaultValue: 0),
                    created_at_utc = table.Column<DateTime>(type: "timestamp without time zone", nullable: false),
                    completed_at_utc = table.Column<DateTime>(type: "timestamp without time zone", nullable: true),
                    completed_by_super_admin_id = table.Column<Guid>(type: "uuid", nullable: true),
                    payout_id = table.Column<Guid>(type: "uuid", nullable: true),
                    receipt_image_key = table.Column<string>(type: "character varying(512)", maxLength: 512, nullable: true),
                    note = table.Column<string>(type: "character varying(512)", maxLength: 512, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_staff_compensation_payout_requests", x => x.id);
                    table.ForeignKey(
                        name: "FK_staff_compensation_payout_requests_staff_compensation_payou~",
                        column: x => x.payout_id,
                        principalTable: "staff_compensation_payouts",
                        principalColumn: "id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_staff_compensation_payout_requests_users_completed_by_super~",
                        column: x => x.completed_by_super_admin_id,
                        principalTable: "users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_staff_compensation_payout_requests_users_staff_user_id",
                        column: x => x.staff_user_id,
                        principalTable: "users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_staff_compensation_payout_requests_completed_by_super_admin~",
                table: "staff_compensation_payout_requests",
                column: "completed_by_super_admin_id");

            migrationBuilder.CreateIndex(
                name: "IX_staff_compensation_payout_requests_payout_id",
                table: "staff_compensation_payout_requests",
                column: "payout_id");

            migrationBuilder.CreateIndex(
                name: "ix_staff_compensation_payout_requests_staff_status",
                table: "staff_compensation_payout_requests",
                columns: new[] { "staff_user_id", "status" });

            migrationBuilder.CreateIndex(
                name: "ix_staff_compensation_payout_requests_status_created_at",
                table: "staff_compensation_payout_requests",
                columns: new[] { "status", "created_at_utc" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "staff_compensation_payout_requests");
        }
    }
}
