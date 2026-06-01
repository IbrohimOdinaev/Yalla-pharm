using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddTelegramPrescriptionNotifications : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "ux_tg_outbox_order_msgkey_chat",
                table: "telegram_outbox_messages");

            migrationBuilder.DropIndex(
                name: "ux_tg_outbox_order_status_chat",
                table: "telegram_outbox_messages");

            migrationBuilder.AlterColumn<int>(
                name: "status_snapshot",
                table: "telegram_outbox_messages",
                type: "integer",
                nullable: true,
                oldClrType: typeof(int),
                oldType: "integer");

            migrationBuilder.AlterColumn<Guid>(
                name: "order_id",
                table: "telegram_outbox_messages",
                type: "uuid",
                nullable: true,
                oldClrType: typeof(Guid),
                oldType: "uuid");

            migrationBuilder.AddColumn<Guid>(
                name: "prescription_id",
                table: "telegram_outbox_messages",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "prescription_status_snapshot",
                table: "telegram_outbox_messages",
                type: "integer",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "ux_tg_outbox_order_msgkey_chat",
                table: "telegram_outbox_messages",
                columns: new[] { "order_id", "message_key", "chat_id" },
                unique: true,
                filter: "order_id IS NOT NULL AND message_key IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "ux_tg_outbox_order_status_chat",
                table: "telegram_outbox_messages",
                columns: new[] { "order_id", "status_snapshot", "chat_id" },
                unique: true,
                filter: "order_id IS NOT NULL AND status_snapshot IS NOT NULL AND message_key IS NULL");

            migrationBuilder.CreateIndex(
                name: "ux_tg_outbox_prescription_msgkey_chat",
                table: "telegram_outbox_messages",
                columns: new[] { "prescription_id", "message_key", "chat_id" },
                unique: true,
                filter: "prescription_id IS NOT NULL AND message_key IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "ux_tg_outbox_prescription_status_chat",
                table: "telegram_outbox_messages",
                columns: new[] { "prescription_id", "prescription_status_snapshot", "chat_id" },
                unique: true,
                filter: "prescription_id IS NOT NULL AND prescription_status_snapshot IS NOT NULL AND message_key IS NULL");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "ux_tg_outbox_order_msgkey_chat",
                table: "telegram_outbox_messages");

            migrationBuilder.DropIndex(
                name: "ux_tg_outbox_order_status_chat",
                table: "telegram_outbox_messages");

            migrationBuilder.DropIndex(
                name: "ux_tg_outbox_prescription_msgkey_chat",
                table: "telegram_outbox_messages");

            migrationBuilder.DropIndex(
                name: "ux_tg_outbox_prescription_status_chat",
                table: "telegram_outbox_messages");

            migrationBuilder.DropColumn(
                name: "prescription_id",
                table: "telegram_outbox_messages");

            migrationBuilder.DropColumn(
                name: "prescription_status_snapshot",
                table: "telegram_outbox_messages");

            migrationBuilder.AlterColumn<int>(
                name: "status_snapshot",
                table: "telegram_outbox_messages",
                type: "integer",
                nullable: false,
                defaultValue: 0,
                oldClrType: typeof(int),
                oldType: "integer",
                oldNullable: true);

            migrationBuilder.AlterColumn<Guid>(
                name: "order_id",
                table: "telegram_outbox_messages",
                type: "uuid",
                nullable: false,
                defaultValue: new Guid("00000000-0000-0000-0000-000000000000"),
                oldClrType: typeof(Guid),
                oldType: "uuid",
                oldNullable: true);

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
    }
}
