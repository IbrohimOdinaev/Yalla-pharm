using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class RemovePharmacyFromRefundRequest : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_refund_requests_pharmacies_pharmacy_id",
                table: "refund_requests");

            migrationBuilder.DropIndex(
                name: "IX_refund_requests_pharmacy_id",
                table: "refund_requests");

            migrationBuilder.DropColumn(
                name: "pharmacy_id",
                table: "refund_requests");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "pharmacy_id",
                table: "refund_requests",
                type: "uuid",
                nullable: false,
                defaultValue: new Guid("00000000-0000-0000-0000-000000000000"));

            migrationBuilder.CreateIndex(
                name: "IX_refund_requests_pharmacy_id",
                table: "refund_requests",
                column: "pharmacy_id");

            migrationBuilder.AddForeignKey(
                name: "FK_refund_requests_pharmacies_pharmacy_id",
                table: "refund_requests",
                column: "pharmacy_id",
                principalTable: "pharmacies",
                principalColumn: "id",
                onDelete: ReferentialAction.Cascade);
        }
    }
}
