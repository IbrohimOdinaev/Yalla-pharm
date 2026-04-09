using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddDeliveryData : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "delivery_data",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    order_id = table.Column<Guid>(type: "uuid", nullable: false),
                    from_address_id = table.Column<long>(type: "bigint", nullable: true),
                    from_title = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false),
                    from_address = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false),
                    from_latitude = table.Column<double>(type: "double precision", nullable: false),
                    from_longitude = table.Column<double>(type: "double precision", nullable: false),
                    to_address_id = table.Column<long>(type: "bigint", nullable: true),
                    to_title = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false),
                    to_address = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false),
                    to_latitude = table.Column<double>(type: "double precision", nullable: false),
                    to_longitude = table.Column<double>(type: "double precision", nullable: false),
                    delivery_cost = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false, defaultValue: 0m),
                    distance = table.Column<double>(type: "double precision", nullable: true),
                    jura_order_id = table.Column<long>(type: "bigint", nullable: true),
                    jura_status = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: true),
                    jura_status_id = table.Column<int>(type: "integer", nullable: true),
                    driver_device_id = table.Column<long>(type: "bigint", nullable: true),
                    driver_name = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    driver_phone = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_delivery_data", x => x.id);
                    table.ForeignKey(
                        name: "FK_delivery_data_orders_order_id",
                        column: x => x.order_id,
                        principalTable: "orders",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "ix_delivery_data_jura_order_id",
                table: "delivery_data",
                column: "jura_order_id");

            migrationBuilder.CreateIndex(
                name: "ux_delivery_data_order_id",
                table: "delivery_data",
                column: "order_id",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "delivery_data");
        }
    }
}
