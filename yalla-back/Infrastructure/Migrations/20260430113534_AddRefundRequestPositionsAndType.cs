using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddRefundRequestPositionsAndType : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "type",
                table: "refund_requests",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.CreateTable(
                name: "refund_request_positions",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    refund_request_id = table.Column<Guid>(type: "uuid", nullable: false),
                    order_position_id = table.Column<Guid>(type: "uuid", nullable: false),
                    medicine_id = table.Column<Guid>(type: "uuid", nullable: false),
                    medicine_name = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: false),
                    quantity = table.Column<int>(type: "integer", nullable: false),
                    unit_price = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    line_total = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_refund_request_positions", x => x.id);
                    table.ForeignKey(
                        name: "FK_refund_request_positions_refund_requests_refund_request_id",
                        column: x => x.refund_request_id,
                        principalTable: "refund_requests",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "ix_refund_request_positions_refund_request_id",
                table: "refund_request_positions",
                column: "refund_request_id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "refund_request_positions");

            migrationBuilder.DropColumn(
                name: "type",
                table: "refund_requests");
        }
    }
}
