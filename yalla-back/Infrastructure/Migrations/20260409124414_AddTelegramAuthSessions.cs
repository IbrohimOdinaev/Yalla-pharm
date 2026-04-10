using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Yalla.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddTelegramAuthSessions : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "telegram_username",
                table: "users",
                type: "character varying(64)",
                maxLength: 64,
                nullable: true);

            migrationBuilder.CreateTable(
                name: "telegram_auth_sessions",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    nonce = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    status = table.Column<int>(type: "integer", nullable: false),
                    telegram_user_id = table.Column<long>(type: "bigint", nullable: true),
                    telegram_username = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: true),
                    telegram_first_name = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    telegram_last_name = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    confirmation_chat_id = table.Column<long>(type: "bigint", nullable: true),
                    confirmation_message_id = table.Column<int>(type: "integer", nullable: true),
                    created_at_utc = table.Column<DateTime>(type: "timestamp without time zone", nullable: false),
                    expires_at_utc = table.Column<DateTime>(type: "timestamp without time zone", nullable: false),
                    updated_at_utc = table.Column<DateTime>(type: "timestamp without time zone", nullable: false),
                    consumed_at_utc = table.Column<DateTime>(type: "timestamp without time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_telegram_auth_sessions", x => x.id);
                });

            migrationBuilder.UpdateData(
                table: "users",
                keyColumn: "id",
                keyValue: new Guid("3f9a5f72-3c3d-4d3b-a4d8-1c5fd2194d4a"),
                column: "telegram_username",
                value: null);

            migrationBuilder.CreateIndex(
                name: "ix_telegram_auth_sessions_expires_at_utc",
                table: "telegram_auth_sessions",
                column: "expires_at_utc");

            migrationBuilder.CreateIndex(
                name: "ix_telegram_auth_sessions_nonce",
                table: "telegram_auth_sessions",
                column: "nonce",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "telegram_auth_sessions");

            migrationBuilder.DropColumn(
                name: "telegram_username",
                table: "users");
        }
    }
}
