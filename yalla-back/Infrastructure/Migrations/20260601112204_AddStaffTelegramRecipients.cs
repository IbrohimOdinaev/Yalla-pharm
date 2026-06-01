using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddStaffTelegramRecipients : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "ux_staff_tg_outbox_msgkey_worker",
                table: "staff_telegram_outbox_messages");

            migrationBuilder.CreateTable(
                name: "staff_telegram_recipients",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    pharmacy_worker_id = table.Column<Guid>(type: "uuid", nullable: false),
                    chat_id = table.Column<long>(type: "bigint", nullable: false),
                    telegram_user_id = table.Column<long>(type: "bigint", nullable: false),
                    telegram_username = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: true),
                    telegram_first_name = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: true),
                    telegram_last_name = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: true),
                    is_active = table.Column<bool>(type: "boolean", nullable: false, defaultValue: true),
                    created_at_utc = table.Column<DateTime>(type: "timestamp without time zone", nullable: false),
                    updated_at_utc = table.Column<DateTime>(type: "timestamp without time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_staff_telegram_recipients", x => x.id);
                });

            migrationBuilder.CreateIndex(
                name: "ux_staff_tg_outbox_msgkey_worker_chat",
                table: "staff_telegram_outbox_messages",
                columns: new[] { "message_key", "pharmacy_worker_id", "chat_id" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_staff_tg_recipients_worker_active",
                table: "staff_telegram_recipients",
                columns: new[] { "pharmacy_worker_id", "is_active" });

            migrationBuilder.CreateIndex(
                name: "ux_staff_tg_recipients_worker_chat",
                table: "staff_telegram_recipients",
                columns: new[] { "pharmacy_worker_id", "chat_id" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "staff_telegram_recipients");

            migrationBuilder.DropIndex(
                name: "ux_staff_tg_outbox_msgkey_worker_chat",
                table: "staff_telegram_outbox_messages");

            migrationBuilder.CreateIndex(
                name: "ux_staff_tg_outbox_msgkey_worker",
                table: "staff_telegram_outbox_messages",
                columns: new[] { "message_key", "pharmacy_worker_id" },
                unique: true);
        }
    }
}
