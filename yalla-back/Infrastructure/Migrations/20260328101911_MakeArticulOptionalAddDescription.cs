using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class MakeArticulOptionalAddDescription : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "ix_medicines_articul",
                table: "medicines");

            migrationBuilder.AlterColumn<string>(
                name: "articul",
                table: "medicines",
                type: "character varying(128)",
                maxLength: 128,
                nullable: true,
                oldClrType: typeof(string),
                oldType: "character varying(128)",
                oldMaxLength: 128);

            migrationBuilder.AddColumn<string>(
                name: "description",
                table: "medicines",
                type: "text",
                nullable: false,
                defaultValue: "");

            migrationBuilder.CreateIndex(
                name: "ix_medicines_articul",
                table: "medicines",
                column: "articul",
                unique: true,
                filter: "articul IS NOT NULL");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "ix_medicines_articul",
                table: "medicines");

            migrationBuilder.DropColumn(
                name: "description",
                table: "medicines");

            migrationBuilder.AlterColumn<string>(
                name: "articul",
                table: "medicines",
                type: "character varying(128)",
                maxLength: 128,
                nullable: false,
                defaultValue: "",
                oldClrType: typeof(string),
                oldType: "character varying(128)",
                oldMaxLength: 128,
                oldNullable: true);

            migrationBuilder.CreateIndex(
                name: "ix_medicines_articul",
                table: "medicines",
                column: "articul",
                unique: true);
        }
    }
}
