using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using Yalla.Infrastructure;

#nullable disable

namespace Yalla.Infrastructure.Migrations
{
    [DbContext(typeof(AppDbContext))]
    [Migration("20260418170000_AddSmsOutboxMessageKey")]
    public partial class AddSmsOutboxMessageKey : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "message_key",
                table: "sms_outbox_messages",
                type: "character varying(64)",
                maxLength: 64,
                nullable: true);

            // Old unique index was unconditional — recreate with a filter so legacy
            // rows (message_key IS NULL) keep their dedup behaviour but JURA-keyed
            // rows use the new filtered index instead.
            migrationBuilder.DropIndex(
                name: "ux_sms_outbox_order_status_phone",
                table: "sms_outbox_messages");

            migrationBuilder.CreateIndex(
                name: "ux_sms_outbox_order_status_phone",
                table: "sms_outbox_messages",
                columns: new[] { "order_id", "status_snapshot", "phone_number" },
                unique: true,
                filter: "message_key IS NULL");

            migrationBuilder.CreateIndex(
                name: "ux_sms_outbox_order_msgkey_phone",
                table: "sms_outbox_messages",
                columns: new[] { "order_id", "message_key", "phone_number" },
                unique: true,
                filter: "message_key IS NOT NULL");
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "ux_sms_outbox_order_msgkey_phone",
                table: "sms_outbox_messages");

            migrationBuilder.DropIndex(
                name: "ux_sms_outbox_order_status_phone",
                table: "sms_outbox_messages");

            migrationBuilder.CreateIndex(
                name: "ux_sms_outbox_order_status_phone",
                table: "sms_outbox_messages",
                columns: new[] { "order_id", "status_snapshot", "phone_number" },
                unique: true);

            migrationBuilder.DropColumn(
                name: "message_key",
                table: "sms_outbox_messages");
        }
    }
}
