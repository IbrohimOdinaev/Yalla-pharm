using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class RefactorOfferSnapshot : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_users_pharmacies_pharmacy_id",
                table: "users");

            migrationBuilder.DropPrimaryKey(
                name: "PK_offers",
                table: "offers");

            migrationBuilder.DropColumn(
                name: "offer_medicine_id",
                table: "positions");

            migrationBuilder.DropColumn(
                name: "offer_stock_quantity",
                table: "positions");

            migrationBuilder.AddColumn<Guid>(
                name: "id",
                table: "offers",
                type: "uuid",
                nullable: true);

            migrationBuilder.Sql(
                """
                UPDATE offers
                SET id = md5(medicine_id::text || pharmacy_id::text)::uuid
                WHERE id IS NULL;
                """);

            migrationBuilder.AlterColumn<Guid>(
                name: "id",
                table: "offers",
                type: "uuid",
                nullable: false,
                oldClrType: typeof(Guid),
                oldType: "uuid",
                oldNullable: true);

            migrationBuilder.AddPrimaryKey(
                name: "PK_offers",
                table: "offers",
                column: "id");

            migrationBuilder.CreateIndex(
                name: "ux_offers_medicine_id_pharmacy_id",
                table: "offers",
                columns: new[] { "medicine_id", "pharmacy_id" },
                unique: true);

            migrationBuilder.AddForeignKey(
                name: "FK_offers_pharmacies_pharmacy_id",
                table: "offers",
                column: "pharmacy_id",
                principalTable: "pharmacies",
                principalColumn: "id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_users_pharmacies_pharmacy_id",
                table: "users",
                column: "pharmacy_id",
                principalTable: "pharmacies",
                principalColumn: "id",
                onDelete: ReferentialAction.Cascade);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_offers_pharmacies_pharmacy_id",
                table: "offers");

            migrationBuilder.DropForeignKey(
                name: "FK_users_pharmacies_pharmacy_id",
                table: "users");

            migrationBuilder.DropPrimaryKey(
                name: "PK_offers",
                table: "offers");

            migrationBuilder.DropIndex(
                name: "ux_offers_medicine_id_pharmacy_id",
                table: "offers");

            migrationBuilder.DropColumn(
                name: "id",
                table: "offers");

            migrationBuilder.AddColumn<Guid>(
                name: "offer_medicine_id",
                table: "positions",
                type: "uuid",
                nullable: false,
                defaultValue: new Guid("00000000-0000-0000-0000-000000000000"));

            migrationBuilder.AddColumn<int>(
                name: "offer_stock_quantity",
                table: "positions",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddPrimaryKey(
                name: "PK_offers",
                table: "offers",
                columns: new[] { "medicine_id", "pharmacy_id" });

            migrationBuilder.AddForeignKey(
                name: "FK_users_pharmacies_pharmacy_id",
                table: "users",
                column: "pharmacy_id",
                principalTable: "pharmacies",
                principalColumn: "id",
                onDelete: ReferentialAction.Restrict);
        }
    }
}
