using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class InitialCreate : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "medicines",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    url = table.Column<string>(type: "character varying(1024)", maxLength: 1024, nullable: true),
                    title = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: false),
                    articul = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_medicines", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "pharmacies",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    title = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: false),
                    address = table.Column<string>(type: "character varying(512)", maxLength: 512, nullable: false),
                    admin_id = table.Column<Guid>(type: "uuid", nullable: false),
                    is_active = table.Column<bool>(type: "boolean", nullable: false, defaultValue: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_pharmacies", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "medicine_attributes",
                columns: table => new
                {
                    id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    name = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    option = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false),
                    medicine_id = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_medicine_attributes", x => x.id);
                    table.ForeignKey(
                        name: "FK_medicine_attributes_medicines_medicine_id",
                        column: x => x.medicine_id,
                        principalTable: "medicines",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "offers",
                columns: table => new
                {
                    medicine_id = table.Column<Guid>(type: "uuid", nullable: false),
                    pharmacy_id = table.Column<Guid>(type: "uuid", nullable: false),
                    stock_quantity = table.Column<int>(type: "integer", nullable: false, defaultValue: 0),
                    price = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false, defaultValue: 0m)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_offers", x => new { x.medicine_id, x.pharmacy_id });
                    table.ForeignKey(
                        name: "FK_offers_medicines_medicine_id",
                        column: x => x.medicine_id,
                        principalTable: "medicines",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "users",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    name = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    phone_number = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    user_type = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    pharmacy_id = table.Column<Guid>(type: "uuid", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_users", x => x.id);
                    table.ForeignKey(
                        name: "FK_users_pharmacies_pharmacy_id",
                        column: x => x.pharmacy_id,
                        principalTable: "pharmacies",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "orders",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    client_id = table.Column<Guid>(type: "uuid", nullable: false),
                    delivery_address = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false),
                    cost = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false, defaultValue: 0m),
                    return_cost = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false, defaultValue: 0m),
                    status = table.Column<int>(type: "integer", nullable: false, defaultValue: 0)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_orders", x => x.id);
                    table.ForeignKey(
                        name: "FK_orders_users_client_id",
                        column: x => x.client_id,
                        principalTable: "users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "pharmacy_orders",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    pharmacy_id = table.Column<Guid>(type: "uuid", nullable: false),
                    order_id = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_pharmacy_orders", x => x.id);
                    table.ForeignKey(
                        name: "FK_pharmacy_orders_orders_order_id",
                        column: x => x.order_id,
                        principalTable: "orders",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_pharmacy_orders_pharmacies_pharmacy_id",
                        column: x => x.pharmacy_id,
                        principalTable: "pharmacies",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "positions",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    order_id = table.Column<Guid>(type: "uuid", nullable: true),
                    client_id = table.Column<Guid>(type: "uuid", nullable: false),
                    offer_medicine_id = table.Column<Guid>(type: "uuid", nullable: false),
                    offer_pharmacy_id = table.Column<Guid>(type: "uuid", nullable: false),
                    offer_stock_quantity = table.Column<int>(type: "integer", nullable: false),
                    offer_price = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    medicine_id = table.Column<Guid>(type: "uuid", nullable: false),
                    quantity = table.Column<int>(type: "integer", nullable: false, defaultValue: 1),
                    basket_client_id = table.Column<Guid>(type: "uuid", nullable: true)
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
                name: "IX_medicine_attributes_medicine_id",
                table: "medicine_attributes",
                column: "medicine_id");

            migrationBuilder.CreateIndex(
                name: "ix_medicines_articul",
                table: "medicines",
                column: "articul");

            migrationBuilder.CreateIndex(
                name: "ix_offers_pharmacy_id",
                table: "offers",
                column: "pharmacy_id");

            migrationBuilder.CreateIndex(
                name: "IX_order_rejected_positions_position_id",
                table: "order_rejected_positions",
                column: "position_id");

            migrationBuilder.CreateIndex(
                name: "ix_orders_client_id",
                table: "orders",
                column: "client_id");

            migrationBuilder.CreateIndex(
                name: "ix_orders_status",
                table: "orders",
                column: "status");

            migrationBuilder.CreateIndex(
                name: "ix_pharmacies_admin_id",
                table: "pharmacies",
                column: "admin_id");

            migrationBuilder.CreateIndex(
                name: "IX_pharmacy_order_positions_position_id",
                table: "pharmacy_order_positions",
                column: "position_id");

            migrationBuilder.CreateIndex(
                name: "IX_pharmacy_order_rejected_positions_position_id",
                table: "pharmacy_order_rejected_positions",
                column: "position_id");

            migrationBuilder.CreateIndex(
                name: "ix_pharmacy_orders_order_id",
                table: "pharmacy_orders",
                column: "order_id");

            migrationBuilder.CreateIndex(
                name: "ix_pharmacy_orders_pharmacy_id",
                table: "pharmacy_orders",
                column: "pharmacy_id");

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

            migrationBuilder.CreateIndex(
                name: "ix_users_pharmacy_id",
                table: "users",
                column: "pharmacy_id");

            migrationBuilder.CreateIndex(
                name: "ix_users_phone_number",
                table: "users",
                column: "phone_number");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "medicine_attributes");

            migrationBuilder.DropTable(
                name: "offers");

            migrationBuilder.DropTable(
                name: "order_rejected_positions");

            migrationBuilder.DropTable(
                name: "pharmacy_order_positions");

            migrationBuilder.DropTable(
                name: "pharmacy_order_rejected_positions");

            migrationBuilder.DropTable(
                name: "pharmacy_orders");

            migrationBuilder.DropTable(
                name: "positions");

            migrationBuilder.DropTable(
                name: "medicines");

            migrationBuilder.DropTable(
                name: "orders");

            migrationBuilder.DropTable(
                name: "users");

            migrationBuilder.DropTable(
                name: "pharmacies");
        }
    }
}
