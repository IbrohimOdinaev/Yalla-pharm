using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddPharmacyAccountAndOrderAcceptedAdmin : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "accepted_by_admin_id",
                table: "orders",
                type: "uuid",
                nullable: true);

            migrationBuilder.Sql("""
                UPDATE users AS u
                SET "Role" = 4
                FROM pharmacies AS p
                WHERE p.admin_id = u.id
                  AND u.user_type = 'pharmacy_worker'
                  AND u."Role" = 1;
                """);

            migrationBuilder.CreateIndex(
                name: "ix_orders_accepted_by_admin_id",
                table: "orders",
                column: "accepted_by_admin_id");

            migrationBuilder.AddForeignKey(
                name: "FK_orders_users_accepted_by_admin_id",
                table: "orders",
                column: "accepted_by_admin_id",
                principalTable: "users",
                principalColumn: "id",
                onDelete: ReferentialAction.SetNull);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_orders_users_accepted_by_admin_id",
                table: "orders");

            migrationBuilder.DropIndex(
                name: "ix_orders_accepted_by_admin_id",
                table: "orders");

            migrationBuilder.Sql("""
                UPDATE users
                SET "Role" = 1
                WHERE user_type = 'pharmacy_worker'
                  AND "Role" = 4;
                """);

            migrationBuilder.DropColumn(
                name: "accepted_by_admin_id",
                table: "orders");
        }
    }
}
