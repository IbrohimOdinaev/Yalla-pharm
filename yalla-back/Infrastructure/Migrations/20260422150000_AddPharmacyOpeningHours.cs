using System;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using Yalla.Infrastructure;

#nullable disable

namespace Yalla.Infrastructure.Migrations
{
    [DbContext(typeof(AppDbContext))]
    [Migration("20260422150000_AddPharmacyOpeningHours")]
    public partial class AddPharmacyOpeningHours : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<TimeOnly>(
                name: "opens_at",
                table: "pharmacies",
                type: "time without time zone",
                nullable: true);

            migrationBuilder.AddColumn<TimeOnly>(
                name: "closes_at",
                table: "pharmacies",
                type: "time without time zone",
                nullable: true);
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "opens_at",
                table: "pharmacies");

            migrationBuilder.DropColumn(
                name: "closes_at",
                table: "pharmacies");
        }
    }
}
