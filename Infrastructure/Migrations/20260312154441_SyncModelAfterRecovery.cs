using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class SyncModelAfterRecovery : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "url",
                table: "medicines");

            migrationBuilder.AddColumn<string>(
                name: "password_hash",
                table: "users",
                type: "character varying(200)",
                maxLength: 200,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "idempotency_key",
                table: "orders",
                type: "character varying(128)",
                maxLength: 128,
                nullable: true);

            migrationBuilder.CreateTable(
                name: "checkout_requests",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    client_id = table.Column<Guid>(type: "uuid", nullable: false),
                    idempotency_key = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: false),
                    request_hash = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: false),
                    status = table.Column<int>(type: "integer", nullable: false, defaultValue: 0),
                    order_id = table.Column<Guid>(type: "uuid", nullable: true),
                    payment_transaction_id = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: true),
                    failure_reason = table.Column<string>(type: "character varying(512)", maxLength: 512, nullable: true),
                    created_at_utc = table.Column<DateTime>(type: "timestamp without time zone", nullable: false),
                    updated_at_utc = table.Column<DateTime>(type: "timestamp without time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_checkout_requests", x => x.id);
                    table.ForeignKey(
                        name: "FK_checkout_requests_orders_order_id",
                        column: x => x.order_id,
                        principalTable: "orders",
                        principalColumn: "id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_checkout_requests_users_client_id",
                        column: x => x.client_id,
                        principalTable: "users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "medicine_images",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    key = table.Column<string>(type: "character varying(1024)", maxLength: 1024, nullable: false),
                    is_main = table.Column<bool>(type: "boolean", nullable: false),
                    is_minimal = table.Column<bool>(type: "boolean", nullable: false),
                    medicine_id = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_medicine_images", x => x.id);
                    table.ForeignKey(
                        name: "FK_medicine_images_medicines_medicine_id",
                        column: x => x.medicine_id,
                        principalTable: "medicines",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

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

            migrationBuilder.InsertData(
                table: "users",
                columns: new[] { "id", "name", "password_hash", "phone_number", "Role", "user_type" },
                values: new object[] { new Guid("3f9a5f72-3c3d-4d3b-a4d8-1c5fd2194d4a"), "SuperAdmin", "$2a$06$qFsTGnRwnIMyAk6g4Q6tBedOweqKHvlgZHjoy0eWYF19jgFj.7NM.", "919191919", 2, "User" });

            migrationBuilder.CreateIndex(
                name: "ux_orders_client_idempotency_key",
                table: "orders",
                columns: new[] { "client_id", "idempotency_key" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_checkout_requests_order_id",
                table: "checkout_requests",
                column: "order_id");

            migrationBuilder.CreateIndex(
                name: "ix_checkout_requests_status",
                table: "checkout_requests",
                column: "status");

            migrationBuilder.CreateIndex(
                name: "ux_checkout_requests_client_idempotency_key",
                table: "checkout_requests",
                columns: new[] { "client_id", "idempotency_key" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ux_medicine_images_medicine_main",
                table: "medicine_images",
                columns: new[] { "medicine_id", "is_main" },
                unique: true,
                filter: "is_main");

            migrationBuilder.CreateIndex(
                name: "ux_medicine_images_medicine_minimal",
                table: "medicine_images",
                columns: new[] { "medicine_id", "is_minimal" },
                unique: true,
                filter: "is_minimal");

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
                name: "checkout_requests");

            migrationBuilder.DropTable(
                name: "medicine_images");

            migrationBuilder.DropTable(
                name: "refund_requests");

            migrationBuilder.DropIndex(
                name: "ux_orders_client_idempotency_key",
                table: "orders");

            migrationBuilder.DeleteData(
                table: "users",
                keyColumn: "id",
                keyValue: new Guid("3f9a5f72-3c3d-4d3b-a4d8-1c5fd2194d4a"));

            migrationBuilder.DropColumn(
                name: "password_hash",
                table: "users");

            migrationBuilder.DropColumn(
                name: "idempotency_key",
                table: "orders");

            migrationBuilder.AddColumn<string>(
                name: "url",
                table: "medicines",
                type: "character varying(1024)",
                maxLength: 1024,
                nullable: true);
        }
    }
}
