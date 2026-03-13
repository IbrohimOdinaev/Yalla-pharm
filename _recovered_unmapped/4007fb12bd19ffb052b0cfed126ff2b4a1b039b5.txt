using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class RemovePharmacyOrderEntity : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "pharmacy_orders");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "pharmacy_orders",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    order_id = table.Column<Guid>(type: "uuid", nullable: false),
                    pharmacy_id = table.Column<Guid>(type: "uuid", nullable: false)
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

            migrationBuilder.CreateIndex(
                name: "ix_pharmacy_orders_order_id",
                table: "pharmacy_orders",
                column: "order_id");

            migrationBuilder.CreateIndex(
                name: "ix_pharmacy_orders_pharmacy_id",
                table: "pharmacy_orders",
                column: "pharmacy_id");
        }
    }
}
