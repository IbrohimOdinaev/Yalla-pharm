using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using Yalla.Infrastructure;

#nullable disable

namespace Infrastructure.Migrations
{
    [DbContext(typeof(AppDbContext))]
    [Migration("20260313083000_UpdateDefaultSuperAdminSeed")]
    public partial class UpdateDefaultSuperAdminSeed : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(
                """
                UPDATE users
                SET password_hash = '$2a$06$qFsTGnRwnIMyAk6g4Q6tBedOweqKHvlgZHjoy0eWYF19jgFj.7NM.',
                    phone_number = '919191919'
                WHERE id = '3f9a5f72-3c3d-4d3b-a4d8-1c5fd2194d4a';
                """);
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(
                """
                UPDATE users
                SET password_hash = '$2a$06$anJ4jqWfeRQJSDxPxonLhOKUnlmzvCH9CHPlYzav8YMONA3D8Ivpe',
                    phone_number = '4444'
                WHERE id = '3f9a5f72-3c3d-4d3b-a4d8-1c5fd2194d4a';
                """);
        }
    }
}
