using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddStaffCompensation : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<decimal>(
                name: "pharmacy_order_ready_fee_amount",
                table: "payment_settings",
                type: "numeric(18,2)",
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<decimal>(
                name: "prescription_decoded_fee_amount",
                table: "payment_settings",
                type: "numeric(18,2)",
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.CreateTable(
                name: "staff_compensation_earnings",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    staff_user_id = table.Column<Guid>(type: "uuid", nullable: false),
                    staff_role = table.Column<int>(type: "integer", nullable: false),
                    source_type = table.Column<int>(type: "integer", nullable: false),
                    source_id = table.Column<Guid>(type: "uuid", nullable: false),
                    pharmacy_id = table.Column<Guid>(type: "uuid", nullable: true),
                    unit_rate = table.Column<decimal>(type: "numeric(18,2)", nullable: false),
                    amount = table.Column<decimal>(type: "numeric(18,2)", nullable: false),
                    currency = table.Column<string>(type: "character varying(8)", maxLength: 8, nullable: false),
                    created_at_utc = table.Column<DateTime>(type: "timestamp without time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_staff_compensation_earnings", x => x.id);
                    table.ForeignKey(
                        name: "FK_staff_compensation_earnings_pharmacies_pharmacy_id",
                        column: x => x.pharmacy_id,
                        principalTable: "pharmacies",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_staff_compensation_earnings_users_staff_user_id",
                        column: x => x.staff_user_id,
                        principalTable: "users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "staff_compensation_payouts",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    staff_user_id = table.Column<Guid>(type: "uuid", nullable: false),
                    staff_role = table.Column<int>(type: "integer", nullable: false),
                    amount = table.Column<decimal>(type: "numeric(18,2)", nullable: false),
                    currency = table.Column<string>(type: "character varying(8)", maxLength: 8, nullable: false),
                    method = table.Column<int>(type: "integer", nullable: false),
                    receipt_image_key = table.Column<string>(type: "character varying(512)", maxLength: 512, nullable: true),
                    note = table.Column<string>(type: "character varying(512)", maxLength: 512, nullable: true),
                    paid_at_utc = table.Column<DateTime>(type: "timestamp without time zone", nullable: false),
                    paid_by_super_admin_id = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_staff_compensation_payouts", x => x.id);
                    table.ForeignKey(
                        name: "FK_staff_compensation_payouts_users_paid_by_super_admin_id",
                        column: x => x.paid_by_super_admin_id,
                        principalTable: "users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_staff_compensation_payouts_users_staff_user_id",
                        column: x => x.staff_user_id,
                        principalTable: "users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "ix_staff_compensation_earnings_pharmacy_id",
                table: "staff_compensation_earnings",
                column: "pharmacy_id");

            migrationBuilder.CreateIndex(
                name: "ix_staff_compensation_earnings_staff_user_id_created_at_utc",
                table: "staff_compensation_earnings",
                columns: new[] { "staff_user_id", "created_at_utc" });

            migrationBuilder.CreateIndex(
                name: "ux_staff_compensation_earnings_source",
                table: "staff_compensation_earnings",
                columns: new[] { "source_type", "source_id" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_staff_compensation_payouts_paid_by_super_admin_id",
                table: "staff_compensation_payouts",
                column: "paid_by_super_admin_id");

            migrationBuilder.CreateIndex(
                name: "ix_staff_compensation_payouts_staff_user_id_paid_at_utc",
                table: "staff_compensation_payouts",
                columns: new[] { "staff_user_id", "paid_at_utc" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "staff_compensation_earnings");

            migrationBuilder.DropTable(
                name: "staff_compensation_payouts");

            migrationBuilder.DropColumn(
                name: "pharmacy_order_ready_fee_amount",
                table: "payment_settings");

            migrationBuilder.DropColumn(
                name: "prescription_decoded_fee_amount",
                table: "payment_settings");
        }
    }
}
