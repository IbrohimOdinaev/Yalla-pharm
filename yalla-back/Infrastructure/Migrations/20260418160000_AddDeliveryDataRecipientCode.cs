using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using Yalla.Infrastructure;

#nullable disable

namespace Yalla.Infrastructure.Migrations
{
    [DbContext(typeof(AppDbContext))]
    [Migration("20260418160000_AddDeliveryDataRecipientCode")]
    public partial class AddDeliveryDataRecipientCode : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "recipient_code",
                table: "delivery_data",
                type: "character varying(32)",
                maxLength: 32,
                nullable: true);
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "recipient_code",
                table: "delivery_data");
        }
    }
}
