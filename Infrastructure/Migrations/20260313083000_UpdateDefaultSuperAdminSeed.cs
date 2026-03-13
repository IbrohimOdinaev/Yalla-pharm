using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Yalla.Infrastructure.Migrations
{
    public partial class UpdateDefaultSuperAdminSeed : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.UpdateData(
                table: "users",
                keyColumn: "id",
                keyValue: new Guid("3f9a5f72-3c3d-4d3b-a4d8-1c5fd2194d4a"),
                columns: new[] { "password_hash", "phone_number" },
                values: new object[] { "$2a$06$qFsTGnRwnIMyAk6g4Q6tBedOweqKHvlgZHjoy0eWYF19jgFj.7NM.", "919191919" });
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.UpdateData(
                table: "users",
                keyColumn: "id",
                keyValue: new Guid("3f9a5f72-3c3d-4d3b-a4d8-1c5fd2194d4a"),
                columns: new[] { "password_hash", "phone_number" },
                values: new object[] { "$2a$06$anJ4jqWfeRQJSDxPxonLhOKUnlmzvCH9CHPlYzav8YMONA3D8Ivpe", "4444" });
        }
    }
}
