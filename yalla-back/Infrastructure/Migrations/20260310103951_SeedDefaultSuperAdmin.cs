using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using Yalla.Infrastructure;

#nullable disable

namespace Infrastructure.Migrations
{
    /// <inheritdoc />
    [DbContext(typeof(AppDbContext))]
    [Migration("20260310103951_SeedDefaultSuperAdmin")]
    public partial class SeedDefaultSuperAdmin : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(
                """
                INSERT INTO users (id, name, password_hash, phone_number, "Role", user_type)
                VALUES ('3f9a5f72-3c3d-4d3b-a4d8-1c5fd2194d4a', 'SuperAdmin', '$2a$06$qFsTGnRwnIMyAk6g4Q6tBedOweqKHvlgZHjoy0eWYF19jgFj.7NM.', '919191919', 2, 'User')
                ON CONFLICT (id) DO NOTHING;
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(
                "DELETE FROM users WHERE id = '3f9a5f72-3c3d-4d3b-a4d8-1c5fd2194d4a';");
        }
    }
}
