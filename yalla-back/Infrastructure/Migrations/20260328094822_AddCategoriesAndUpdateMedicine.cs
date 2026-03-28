using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddCategoriesAndUpdateMedicine : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "name",
                table: "medicine_attributes");

            migrationBuilder.RenameColumn(
                name: "option",
                table: "medicine_attributes",
                newName: "value");

            migrationBuilder.AddColumn<Guid>(
                name: "category_id",
                table: "medicines",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "woo_commerce_id",
                table: "medicines",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "type",
                table: "medicine_attributes",
                type: "character varying(64)",
                maxLength: 64,
                nullable: false,
                defaultValue: "");

            migrationBuilder.CreateTable(
                name: "categories",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    name = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: false),
                    slug = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: false),
                    parent_id = table.Column<Guid>(type: "uuid", nullable: true),
                    type = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: true),
                    woo_commerce_id = table.Column<int>(type: "integer", nullable: false),
                    description = table.Column<string>(type: "text", nullable: false, defaultValue: ""),
                    is_active = table.Column<bool>(type: "boolean", nullable: false, defaultValue: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_categories", x => x.id);
                    table.ForeignKey(
                        name: "FK_categories_categories_parent_id",
                        column: x => x.parent_id,
                        principalTable: "categories",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "ix_medicines_category_id",
                table: "medicines",
                column: "category_id");

            migrationBuilder.CreateIndex(
                name: "ix_medicines_woo_commerce_id",
                table: "medicines",
                column: "woo_commerce_id",
                unique: true,
                filter: "woo_commerce_id IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_categories_parent_id",
                table: "categories",
                column: "parent_id");

            migrationBuilder.CreateIndex(
                name: "ix_categories_slug",
                table: "categories",
                column: "slug",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_categories_woo_commerce_id",
                table: "categories",
                column: "woo_commerce_id",
                unique: true);

            migrationBuilder.AddForeignKey(
                name: "FK_medicines_categories_category_id",
                table: "medicines",
                column: "category_id",
                principalTable: "categories",
                principalColumn: "id",
                onDelete: ReferentialAction.SetNull);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_medicines_categories_category_id",
                table: "medicines");

            migrationBuilder.DropTable(
                name: "categories");

            migrationBuilder.DropIndex(
                name: "ix_medicines_category_id",
                table: "medicines");

            migrationBuilder.DropIndex(
                name: "ix_medicines_woo_commerce_id",
                table: "medicines");

            migrationBuilder.DropColumn(
                name: "category_id",
                table: "medicines");

            migrationBuilder.DropColumn(
                name: "woo_commerce_id",
                table: "medicines");

            migrationBuilder.DropColumn(
                name: "type",
                table: "medicine_attributes");

            migrationBuilder.RenameColumn(
                name: "value",
                table: "medicine_attributes",
                newName: "option");

            migrationBuilder.AddColumn<string>(
                name: "name",
                table: "medicine_attributes",
                type: "character varying(200)",
                maxLength: 200,
                nullable: false,
                defaultValue: "");
        }
    }
}
