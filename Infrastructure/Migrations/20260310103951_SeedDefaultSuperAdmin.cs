using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class SeedDefaultSuperAdmin : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.InsertData(
                table: "users",
                columns: new[] { "id", "name", "password_hash", "phone_number", "Role", "user_type" },
                values: new object[] { new Guid("3f9a5f72-3c3d-4d3b-a4d8-1c5fd2194d4a"), "SuperAdmin", "$2a$06$qFsTGnRwnIMyAk6g4Q6tBedOweqKHvlgZHjoy0eWYF19jgFj.7NM.", "919191919", 2, "User" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DeleteData(
                table: "users",
                keyColumn: "id",
                keyValue: new Guid("3f9a5f72-3c3d-4d3b-a4d8-1c5fd2194d4a"));
        }
    }
}
