using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddOrderIdempotencyKey : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "idempotency_key",
                table: "orders",
                type: "character varying(128)",
                maxLength: 128,
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "ux_orders_client_idempotency_key",
                table: "orders",
                columns: new[] { "client_id", "idempotency_key" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "ux_orders_client_idempotency_key",
                table: "orders");

            migrationBuilder.DropColumn(
                name: "idempotency_key",
                table: "orders");
        }
    }
}
