using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddSmsVerificationSessions : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "sms_verification_sessions",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    purpose = table.Column<int>(type: "integer", nullable: false, defaultValue: 0),
                    phone_number = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    code_hash = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: false),
                    payload_json = table.Column<string>(type: "text", nullable: true),
                    last_txn_id = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: true),
                    last_msg_id = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: true),
                    status = table.Column<int>(type: "integer", nullable: false, defaultValue: 0),
                    attempts_remaining = table.Column<int>(type: "integer", nullable: false),
                    resends_remaining = table.Column<int>(type: "integer", nullable: false),
                    expires_at_utc = table.Column<DateTime>(type: "timestamp without time zone", nullable: false),
                    resend_available_at_utc = table.Column<DateTime>(type: "timestamp without time zone", nullable: false),
                    created_at_utc = table.Column<DateTime>(type: "timestamp without time zone", nullable: false),
                    updated_at_utc = table.Column<DateTime>(type: "timestamp without time zone", nullable: false),
                    verified_at_utc = table.Column<DateTime>(type: "timestamp without time zone", nullable: true),
                    failure_reason = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_sms_verification_sessions", x => x.id);
                });

            migrationBuilder.CreateIndex(
                name: "ix_sms_verification_sessions_expires_at_utc",
                table: "sms_verification_sessions",
                column: "expires_at_utc");

            migrationBuilder.CreateIndex(
                name: "ix_sms_verification_sessions_purpose_phone_status",
                table: "sms_verification_sessions",
                columns: new[] { "purpose", "phone_number", "status" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "sms_verification_sessions");
        }
    }
}
