using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddManualRefundRequests : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "refund_requests",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    order_id = table.Column<Guid>(type: "uuid", nullable: true),
                    client_id = table.Column<Guid>(type: "uuid", nullable: false),
                    pharmacy_id = table.Column<Guid>(type: "uuid", nullable: false),
                    payment_transaction_id = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: true),
                    amount = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    currency = table.Column<string>(type: "character varying(8)", maxLength: 8, nullable: false),
                    reason = table.Column<string>(type: "character varying(1024)", maxLength: 1024, nullable: false),
                    status = table.Column<int>(type: "integer", nullable: false, defaultValue: 0),
                    created_at_utc = table.Column<DateTime>(type: "timestamp without time zone", nullable: false),
                    updated_at_utc = table.Column<DateTime>(type: "timestamp without time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_refund_requests", x => x.id);
                    table.ForeignKey(
                        name: "FK_refund_requests_orders_order_id",
                        column: x => x.order_id,
                        principalTable: "orders",
                        principalColumn: "id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_refund_requests_pharmacies_pharmacy_id",
                        column: x => x.pharmacy_id,
                        principalTable: "pharmacies",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_refund_requests_users_client_id",
                        column: x => x.client_id,
                        principalTable: "users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_refund_requests_client_id",
                table: "refund_requests",
                column: "client_id");

            migrationBuilder.CreateIndex(
                name: "ix_refund_requests_created_at_utc",
                table: "refund_requests",
                column: "created_at_utc");

            migrationBuilder.CreateIndex(
                name: "ix_refund_requests_order_id",
                table: "refund_requests",
                column: "order_id");

            migrationBuilder.CreateIndex(
                name: "IX_refund_requests_pharmacy_id",
                table: "refund_requests",
                column: "pharmacy_id");

            migrationBuilder.CreateIndex(
                name: "ix_refund_requests_status",
                table: "refund_requests",
                column: "status");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "refund_requests");
        }
    }
}
