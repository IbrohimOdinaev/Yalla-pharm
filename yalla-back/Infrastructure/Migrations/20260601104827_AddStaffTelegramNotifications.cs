using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddStaffTelegramNotifications : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "staff_telegram_outbox_messages",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    order_id = table.Column<Guid>(type: "uuid", nullable: true),
                    manual_lookup_request_id = table.Column<Guid>(type: "uuid", nullable: true),
                    pharmacy_worker_id = table.Column<Guid>(type: "uuid", nullable: false),
                    pharmacy_id = table.Column<Guid>(type: "uuid", nullable: true),
                    chat_id = table.Column<long>(type: "bigint", nullable: false),
                    message_key = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: false),
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
                    table.PrimaryKey("PK_staff_telegram_outbox_messages", x => x.id);
                });

            migrationBuilder.CreateIndex(
                name: "ix_staff_tg_outbox_created_at_utc",
                table: "staff_telegram_outbox_messages",
                column: "created_at_utc");

            migrationBuilder.CreateIndex(
                name: "ix_staff_tg_outbox_state_next_attempt_at_utc",
                table: "staff_telegram_outbox_messages",
                columns: new[] { "state", "next_attempt_at_utc" });

            migrationBuilder.CreateIndex(
                name: "ux_staff_tg_outbox_msgkey_worker",
                table: "staff_telegram_outbox_messages",
                columns: new[] { "message_key", "pharmacy_worker_id" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "staff_telegram_outbox_messages");
        }
    }
}
