using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddOrderPlacedAtUtcPlus5 : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTime>(
                name: "order_placed_at",
                table: "orders",
                type: "timestamp(0) without time zone",
                precision: 0,
                nullable: false,
                defaultValueSql: "date_trunc('second', (now() at time zone 'UTC') + interval '5 hour')");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "order_placed_at",
                table: "orders");
        }
    }
}
