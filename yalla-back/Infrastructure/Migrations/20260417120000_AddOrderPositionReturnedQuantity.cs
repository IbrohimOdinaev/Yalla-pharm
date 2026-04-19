using Microsoft.EntityFrameworkCore.Migrations;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Yalla.Infrastructure;

#nullable disable

namespace Yalla.Infrastructure.Migrations
{
    [DbContext(typeof(AppDbContext))]
    [Migration("20260417120000_AddOrderPositionReturnedQuantity")]
    public partial class AddOrderPositionReturnedQuantity : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "returned_quantity",
                table: "order_positions",
                type: "integer",
                nullable: false,
                defaultValue: 0);
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "returned_quantity",
                table: "order_positions");
        }
    }
}
