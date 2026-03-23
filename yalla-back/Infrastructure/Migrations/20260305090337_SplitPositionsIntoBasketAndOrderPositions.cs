using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class SplitPositionsIntoBasketAndOrderPositions : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "order_rejected_positions");

            migrationBuilder.DropTable(
                name: "pharmacy_order_positions");

            migrationBuilder.DropTable(
                name: "pharmacy_order_rejected_positions");

            migrationBuilder.DropTable(
                name: "positions");

            migrationBuilder.AddColumn<int>(
                name: "Role",
                table: "users",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AlterColumn<DateTime>(
                name: "order_placed_at",
                table: "orders",
                type: "timestamp without time zone",
                nullable: false,
                oldClrType: typeof(DateTime),
                oldType: "timestamp(0) without time zone",
                oldPrecision: 0,
                oldDefaultValueSql: "date_trunc('second', (now() at time zone 'UTC') + interval '5 hour')");

            migrationBuilder.AddColumn<Guid>(
                name: "pharmacy_id",
                table: "orders",
                type: "uuid",
                nullable: false,
                defaultValue: new Guid("00000000-0000-0000-0000-000000000000"));

            migrationBuilder.CreateTable(
                name: "basket_positions",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    client_id = table.Column<Guid>(type: "uuid", nullable: false),
                    medicine_id = table.Column<Guid>(type: "uuid", nullable: false),
                    offer_id = table.Column<Guid>(type: "uuid", nullable: false),
                    quantity = table.Column<int>(type: "integer", nullable: false, defaultValue: 1)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_basket_positions", x => x.id);
                    table.ForeignKey(
                        name: "FK_basket_positions_medicines_medicine_id",
                        column: x => x.medicine_id,
                        principalTable: "medicines",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_basket_positions_offers_offer_id",
                        column: x => x.offer_id,
                        principalTable: "offers",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_basket_positions_users_client_id",
                        column: x => x.client_id,
                        principalTable: "users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "order_positions",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    order_id = table.Column<Guid>(type: "uuid", nullable: false),
                    medicine_id = table.Column<Guid>(type: "uuid", nullable: false),
                    offer_pharmacy_id = table.Column<Guid>(type: "uuid", nullable: false),
                    offer_price = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    quantity = table.Column<int>(type: "integer", nullable: false, defaultValue: 1),
                    is_rejected = table.Column<bool>(type: "boolean", nullable: false, defaultValue: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_order_positions", x => x.id);
                    table.ForeignKey(
                        name: "FK_order_positions_medicines_medicine_id",
                        column: x => x.medicine_id,
                        principalTable: "medicines",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_order_positions_orders_order_id",
                        column: x => x.order_id,
                        principalTable: "orders",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "ix_orders_pharmacy_id",
                table: "orders",
                column: "pharmacy_id");

            migrationBuilder.CreateIndex(
                name: "ix_basket_positions_client_id",
                table: "basket_positions",
                column: "client_id");

            migrationBuilder.CreateIndex(
                name: "ix_basket_positions_medicine_id",
                table: "basket_positions",
                column: "medicine_id");

            migrationBuilder.CreateIndex(
                name: "ix_basket_positions_offer_id",
                table: "basket_positions",
                column: "offer_id");

            migrationBuilder.CreateIndex(
                name: "ix_order_positions_medicine_id",
                table: "order_positions",
                column: "medicine_id");

            migrationBuilder.CreateIndex(
                name: "ix_order_positions_order_id",
                table: "order_positions",
                column: "order_id");

            migrationBuilder.AddForeignKey(
                name: "FK_orders_pharmacies_pharmacy_id",
                table: "orders",
                column: "pharmacy_id",
                principalTable: "pharmacies",
                principalColumn: "id",
                onDelete: ReferentialAction.Cascade);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_orders_pharmacies_pharmacy_id",
                table: "orders");

            migrationBuilder.DropTable(
                name: "basket_positions");

            migrationBuilder.DropTable(
                name: "order_positions");

            migrationBuilder.DropIndex(
                name: "ix_orders_pharmacy_id",
                table: "orders");

            migrationBuilder.DropColumn(
                name: "Role",
                table: "users");

            migrationBuilder.DropColumn(
                name: "pharmacy_id",
                table: "orders");

            migrationBuilder.AlterColumn<DateTime>(
                name: "order_placed_at",
                table: "orders",
                type: "timestamp(0) without time zone",
                precision: 0,
                nullable: false,
                defaultValueSql: "date_trunc('second', (now() at time zone 'UTC') + interval '5 hour')",
                oldClrType: typeof(DateTime),
                oldType: "timestamp without time zone");

            migrationBuilder.CreateTable(
                name: "positions",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    medicine_id = table.Column<Guid>(type: "uuid", nullable: false),
                    client_id = table.Column<Guid>(type: "uuid", nullable: false),
                    order_id = table.Column<Guid>(type: "uuid", nullable: true),
                    quantity = table.Column<int>(type: "integer", nullable: false, defaultValue: 1),
                    basket_client_id = table.Column<Guid>(type: "uuid", nullable: true),
                    offer_pharmacy_id = table.Column<Guid>(type: "uuid", nullable: false),
                    offer_price = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_positions", x => x.id);
                    table.ForeignKey(
                        name: "FK_positions_medicines_medicine_id",
                        column: x => x.medicine_id,
                        principalTable: "medicines",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_positions_orders_order_id",
                        column: x => x.order_id,
                        principalTable: "orders",
                        principalColumn: "id");
                    table.ForeignKey(
                        name: "FK_positions_users_basket_client_id",
                        column: x => x.basket_client_id,
                        principalTable: "users",
                        principalColumn: "id");
                });

            migrationBuilder.CreateTable(
                name: "order_rejected_positions",
                columns: table => new
                {
                    order_id = table.Column<Guid>(type: "uuid", nullable: false),
                    position_id = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_order_rejected_positions", x => new { x.order_id, x.position_id });
                    table.ForeignKey(
                        name: "fk_order_rejected_positions_order_id",
                        column: x => x.order_id,
                        principalTable: "orders",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "fk_order_rejected_positions_position_id",
                        column: x => x.position_id,
                        principalTable: "positions",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "pharmacy_order_positions",
                columns: table => new
                {
                    pharmacy_order_id = table.Column<Guid>(type: "uuid", nullable: false),
                    position_id = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_pharmacy_order_positions", x => new { x.pharmacy_order_id, x.position_id });
                    table.ForeignKey(
                        name: "fk_pharmacy_order_positions_pharmacy_order_id",
                        column: x => x.pharmacy_order_id,
                        principalTable: "pharmacy_orders",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "fk_pharmacy_order_positions_position_id",
                        column: x => x.position_id,
                        principalTable: "positions",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "pharmacy_order_rejected_positions",
                columns: table => new
                {
                    pharmacy_order_id = table.Column<Guid>(type: "uuid", nullable: false),
                    position_id = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_pharmacy_order_rejected_positions", x => new { x.pharmacy_order_id, x.position_id });
                    table.ForeignKey(
                        name: "fk_pharmacy_order_rejected_positions_pharmacy_order_id",
                        column: x => x.pharmacy_order_id,
                        principalTable: "pharmacy_orders",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "fk_pharmacy_order_rejected_positions_position_id",
                        column: x => x.position_id,
                        principalTable: "positions",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_order_rejected_positions_position_id",
                table: "order_rejected_positions",
                column: "position_id");

            migrationBuilder.CreateIndex(
                name: "IX_pharmacy_order_positions_position_id",
                table: "pharmacy_order_positions",
                column: "position_id");

            migrationBuilder.CreateIndex(
                name: "IX_pharmacy_order_rejected_positions_position_id",
                table: "pharmacy_order_rejected_positions",
                column: "position_id");

            migrationBuilder.CreateIndex(
                name: "ix_positions_basket_client_id",
                table: "positions",
                column: "basket_client_id");

            migrationBuilder.CreateIndex(
                name: "ix_positions_medicine_id",
                table: "positions",
                column: "medicine_id");

            migrationBuilder.CreateIndex(
                name: "ix_positions_order_id",
                table: "positions",
                column: "order_id");
        }
    }
}
