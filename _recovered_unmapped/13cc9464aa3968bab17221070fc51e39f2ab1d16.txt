using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class BasketWithoutOfferPerPharmacyPricing : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_basket_positions_offers_offer_id",
                table: "basket_positions");

            migrationBuilder.DropIndex(
                name: "ix_basket_positions_offer_id",
                table: "basket_positions");

            migrationBuilder.DropColumn(
                name: "offer_id",
                table: "basket_positions");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "offer_id",
                table: "basket_positions",
                type: "uuid",
                nullable: false,
                defaultValue: new Guid("00000000-0000-0000-0000-000000000000"));

            migrationBuilder.CreateIndex(
                name: "ix_basket_positions_offer_id",
                table: "basket_positions",
                column: "offer_id");

            migrationBuilder.AddForeignKey(
                name: "FK_basket_positions_offers_offer_id",
                table: "basket_positions",
                column: "offer_id",
                principalTable: "offers",
                principalColumn: "id",
                onDelete: ReferentialAction.Restrict);
        }
    }
}
