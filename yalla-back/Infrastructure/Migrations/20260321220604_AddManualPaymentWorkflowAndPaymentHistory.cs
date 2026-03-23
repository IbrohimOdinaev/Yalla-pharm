using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddManualPaymentWorkflowAndPaymentHistory : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<decimal>(
                name: "payment_amount",
                table: "orders",
                type: "numeric(18,2)",
                precision: 18,
                scale: 2,
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<string>(
                name: "payment_comment",
                table: "orders",
                type: "character varying(512)",
                maxLength: 512,
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "payment_confirmed_at_utc",
                table: "orders",
                type: "timestamp without time zone",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "payment_confirmed_by_user_id",
                table: "orders",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "payment_currency",
                table: "orders",
                type: "character varying(8)",
                maxLength: 8,
                nullable: false,
                defaultValue: "TJS");

            migrationBuilder.AddColumn<DateTime>(
                name: "payment_expires_at_utc",
                table: "orders",
                type: "timestamp without time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "payment_provider",
                table: "orders",
                type: "character varying(64)",
                maxLength: 64,
                nullable: false,
                defaultValue: "Legacy");

            migrationBuilder.AddColumn<string>(
                name: "payment_receiver_account",
                table: "orders",
                type: "character varying(128)",
                maxLength: 128,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<int>(
                name: "payment_state",
                table: "orders",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<string>(
                name: "payment_url",
                table: "orders",
                type: "character varying(2048)",
                maxLength: 2048,
                nullable: true);

            migrationBuilder.CreateTable(
                name: "payment_histories",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    order_id = table.Column<Guid>(type: "uuid", nullable: false),
                    user_id = table.Column<Guid>(type: "uuid", nullable: true),
                    user_phone_number = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    amount = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    currency = table.Column<string>(type: "character varying(8)", maxLength: 8, nullable: false),
                    provider = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    receiver_account = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: false),
                    payment_url = table.Column<string>(type: "character varying(2048)", maxLength: 2048, nullable: true),
                    payment_comment = table.Column<string>(type: "character varying(512)", maxLength: 512, nullable: true),
                    confirmed_by_user_id = table.Column<Guid>(type: "uuid", nullable: false),
                    confirmed_by_phone_number = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    paid_at_utc = table.Column<DateTime>(type: "timestamp without time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_payment_histories", x => x.id);
                    table.ForeignKey(
                        name: "FK_payment_histories_orders_order_id",
                        column: x => x.order_id,
                        principalTable: "orders",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_payment_histories_users_confirmed_by_user_id",
                        column: x => x.confirmed_by_user_id,
                        principalTable: "users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_payment_histories_users_user_id",
                        column: x => x.user_id,
                        principalTable: "users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateIndex(
                name: "IX_orders_payment_confirmed_by_user_id",
                table: "orders",
                column: "payment_confirmed_by_user_id");

            migrationBuilder.CreateIndex(
                name: "ix_orders_payment_state",
                table: "orders",
                column: "payment_state");

            migrationBuilder.CreateIndex(
                name: "ix_orders_status_payment_state_payment_expires_at_utc",
                table: "orders",
                columns: new[] { "status", "payment_state", "payment_expires_at_utc" });

            migrationBuilder.CreateIndex(
                name: "IX_payment_histories_confirmed_by_user_id",
                table: "payment_histories",
                column: "confirmed_by_user_id");

            migrationBuilder.CreateIndex(
                name: "ix_payment_histories_paid_at_utc",
                table: "payment_histories",
                column: "paid_at_utc");

            migrationBuilder.CreateIndex(
                name: "ix_payment_histories_user_id",
                table: "payment_histories",
                column: "user_id");

            migrationBuilder.CreateIndex(
                name: "ux_payment_histories_order_id",
                table: "payment_histories",
                column: "order_id",
                unique: true);

            migrationBuilder.AddForeignKey(
                name: "FK_orders_users_payment_confirmed_by_user_id",
                table: "orders",
                column: "payment_confirmed_by_user_id",
                principalTable: "users",
                principalColumn: "id",
                onDelete: ReferentialAction.SetNull);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_orders_users_payment_confirmed_by_user_id",
                table: "orders");

            migrationBuilder.DropTable(
                name: "payment_histories");

            migrationBuilder.DropIndex(
                name: "IX_orders_payment_confirmed_by_user_id",
                table: "orders");

            migrationBuilder.DropIndex(
                name: "ix_orders_payment_state",
                table: "orders");

            migrationBuilder.DropIndex(
                name: "ix_orders_status_payment_state_payment_expires_at_utc",
                table: "orders");

            migrationBuilder.DropColumn(
                name: "payment_amount",
                table: "orders");

            migrationBuilder.DropColumn(
                name: "payment_comment",
                table: "orders");

            migrationBuilder.DropColumn(
                name: "payment_confirmed_at_utc",
                table: "orders");

            migrationBuilder.DropColumn(
                name: "payment_confirmed_by_user_id",
                table: "orders");

            migrationBuilder.DropColumn(
                name: "payment_currency",
                table: "orders");

            migrationBuilder.DropColumn(
                name: "payment_expires_at_utc",
                table: "orders");

            migrationBuilder.DropColumn(
                name: "payment_provider",
                table: "orders");

            migrationBuilder.DropColumn(
                name: "payment_receiver_account",
                table: "orders");

            migrationBuilder.DropColumn(
                name: "payment_state",
                table: "orders");

            migrationBuilder.DropColumn(
                name: "payment_url",
                table: "orders");
        }
    }
}
