using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddPaymentIntentsForDeferredOrderCreation : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "payment_intents",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    reserved_order_id = table.Column<Guid>(type: "uuid", nullable: false),
                    client_id = table.Column<Guid>(type: "uuid", nullable: false),
                    client_phone_number = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    pharmacy_id = table.Column<Guid>(type: "uuid", nullable: false),
                    is_pickup = table.Column<bool>(type: "boolean", nullable: false, defaultValue: false),
                    delivery_address = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false),
                    amount = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    currency = table.Column<string>(type: "character varying(8)", maxLength: 8, nullable: false),
                    payment_provider = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    payment_receiver_account = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: false),
                    payment_url = table.Column<string>(type: "character varying(2048)", maxLength: 2048, nullable: true),
                    payment_comment = table.Column<string>(type: "character varying(512)", maxLength: 512, nullable: true),
                    state = table.Column<int>(type: "integer", nullable: false, defaultValue: 0),
                    idempotency_key = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: false),
                    created_at_utc = table.Column<DateTime>(type: "timestamp without time zone", nullable: false),
                    updated_at_utc = table.Column<DateTime>(type: "timestamp without time zone", nullable: false),
                    confirmed_at_utc = table.Column<DateTime>(type: "timestamp without time zone", nullable: true),
                    confirmed_by_user_id = table.Column<Guid>(type: "uuid", nullable: true),
                    reject_reason = table.Column<string>(type: "character varying(512)", maxLength: 512, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_payment_intents", x => x.id);
                    table.ForeignKey(
                        name: "FK_payment_intents_pharmacies_pharmacy_id",
                        column: x => x.pharmacy_id,
                        principalTable: "pharmacies",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_payment_intents_users_client_id",
                        column: x => x.client_id,
                        principalTable: "users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_payment_intents_users_confirmed_by_user_id",
                        column: x => x.confirmed_by_user_id,
                        principalTable: "users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateTable(
                name: "payment_intent_positions",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    payment_intent_id = table.Column<Guid>(type: "uuid", nullable: false),
                    medicine_id = table.Column<Guid>(type: "uuid", nullable: false),
                    offer_pharmacy_id = table.Column<Guid>(type: "uuid", nullable: false),
                    offer_price = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    quantity = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_payment_intent_positions", x => x.id);
                    table.ForeignKey(
                        name: "FK_payment_intent_positions_medicines_medicine_id",
                        column: x => x.medicine_id,
                        principalTable: "medicines",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_payment_intent_positions_payment_intents_payment_intent_id",
                        column: x => x.payment_intent_id,
                        principalTable: "payment_intents",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_payment_intent_positions_pharmacies_offer_pharmacy_id",
                        column: x => x.offer_pharmacy_id,
                        principalTable: "pharmacies",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "ix_payment_intent_positions_medicine_id",
                table: "payment_intent_positions",
                column: "medicine_id");

            migrationBuilder.CreateIndex(
                name: "IX_payment_intent_positions_offer_pharmacy_id",
                table: "payment_intent_positions",
                column: "offer_pharmacy_id");

            migrationBuilder.CreateIndex(
                name: "ix_payment_intent_positions_payment_intent_id",
                table: "payment_intent_positions",
                column: "payment_intent_id");

            migrationBuilder.CreateIndex(
                name: "IX_payment_intents_confirmed_by_user_id",
                table: "payment_intents",
                column: "confirmed_by_user_id");

            migrationBuilder.CreateIndex(
                name: "ix_payment_intents_created_at_utc",
                table: "payment_intents",
                column: "created_at_utc");

            migrationBuilder.CreateIndex(
                name: "IX_payment_intents_pharmacy_id",
                table: "payment_intents",
                column: "pharmacy_id");

            migrationBuilder.CreateIndex(
                name: "ix_payment_intents_state",
                table: "payment_intents",
                column: "state");

            migrationBuilder.CreateIndex(
                name: "ux_payment_intents_client_idempotency_key",
                table: "payment_intents",
                columns: new[] { "client_id", "idempotency_key" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ux_payment_intents_reserved_order_id",
                table: "payment_intents",
                column: "reserved_order_id",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "payment_intent_positions");

            migrationBuilder.DropTable(
                name: "payment_intents");
        }
    }
}
