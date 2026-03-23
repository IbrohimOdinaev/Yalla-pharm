using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddSmsOutboxForOrderStatusNotifications : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "sms_outbox_messages",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    order_id = table.Column<Guid>(type: "uuid", nullable: false),
                    phone_number = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    status_snapshot = table.Column<int>(type: "integer", nullable: false),
                    message = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: false),
                    provider = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    attempt_count = table.Column<int>(type: "integer", nullable: false, defaultValue: 0),
                    next_attempt_at_utc = table.Column<DateTime>(type: "timestamp without time zone", nullable: false),
                    sent_at_utc = table.Column<DateTime>(type: "timestamp without time zone", nullable: true),
                    state = table.Column<int>(type: "integer", nullable: false, defaultValue: 0),
                    txn_id = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: true),
                    msg_id = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: true),
                    last_error_code = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: true),
                    last_error_message = table.Column<string>(type: "character varying(512)", maxLength: 512, nullable: true),
                    created_at_utc = table.Column<DateTime>(type: "timestamp without time zone", nullable: false),
                    updated_at_utc = table.Column<DateTime>(type: "timestamp without time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_sms_outbox_messages", x => x.id);
                });

            migrationBuilder.CreateIndex(
                name: "ix_sms_outbox_created_at_utc",
                table: "sms_outbox_messages",
                column: "created_at_utc");

            migrationBuilder.CreateIndex(
                name: "ix_sms_outbox_state_next_attempt_at_utc",
                table: "sms_outbox_messages",
                columns: new[] { "state", "next_attempt_at_utc" });

            migrationBuilder.CreateIndex(
                name: "ux_sms_outbox_order_status_phone",
                table: "sms_outbox_messages",
                columns: new[] { "order_id", "status_snapshot", "phone_number" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "sms_outbox_messages");
        }
    }
}
