using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddTelegramOutboxMessages : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "telegram_outbox_messages",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    order_id = table.Column<Guid>(type: "uuid", nullable: false),
                    chat_id = table.Column<long>(type: "bigint", nullable: false),
                    status_snapshot = table.Column<int>(type: "integer", nullable: false),
                    message_key = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: true),
                    message = table.Column<string>(type: "character varying(4000)", maxLength: 4000, nullable: false),
                    attempt_count = table.Column<int>(type: "integer", nullable: false, defaultValue: 0),
                    next_attempt_at_utc = table.Column<DateTime>(type: "timestamp without time zone", nullable: false),
                    sent_at_utc = table.Column<DateTime>(type: "timestamp without time zone", nullable: true),
                    state = table.Column<int>(type: "integer", nullable: false, defaultValue: 0),
                    telegram_message_id = table.Column<long>(type: "bigint", nullable: true),
                    last_error_code = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: true),
                    last_error_message = table.Column<string>(type: "character varying(512)", maxLength: 512, nullable: true),
                    created_at_utc = table.Column<DateTime>(type: "timestamp without time zone", nullable: false),
                    updated_at_utc = table.Column<DateTime>(type: "timestamp without time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_telegram_outbox_messages", x => x.id);
                });

            migrationBuilder.CreateIndex(
                name: "ix_tg_outbox_created_at_utc",
                table: "telegram_outbox_messages",
                column: "created_at_utc");

            migrationBuilder.CreateIndex(
                name: "ix_tg_outbox_state_next_attempt_at_utc",
                table: "telegram_outbox_messages",
                columns: new[] { "state", "next_attempt_at_utc" });

            migrationBuilder.CreateIndex(
                name: "ux_tg_outbox_order_msgkey_chat",
                table: "telegram_outbox_messages",
                columns: new[] { "order_id", "message_key", "chat_id" },
                unique: true,
                filter: "message_key IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "ux_tg_outbox_order_status_chat",
                table: "telegram_outbox_messages",
                columns: new[] { "order_id", "status_snapshot", "chat_id" },
                unique: true,
                filter: "message_key IS NULL");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "telegram_outbox_messages");
        }
    }
}
