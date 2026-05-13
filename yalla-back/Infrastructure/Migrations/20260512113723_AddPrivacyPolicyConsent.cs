using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddPrivacyPolicyConsent : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTime>(
                name: "privacy_policy_accepted_at_utc",
                table: "users",
                type: "timestamp without time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "privacy_policy_accepted_from_ip",
                table: "users",
                type: "character varying(64)",
                maxLength: 64,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "privacy_policy_version_accepted",
                table: "users",
                type: "character varying(64)",
                maxLength: 64,
                nullable: true);

            migrationBuilder.CreateTable(
                name: "client_consent_history",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    client_id = table.Column<Guid>(type: "uuid", nullable: false),
                    policy_version = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    accepted_at_utc = table.Column<DateTime>(type: "timestamp without time zone", nullable: false),
                    accepted_from_ip = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: true),
                    user_agent = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_client_consent_history", x => x.id);
                    table.ForeignKey(
                        name: "FK_client_consent_history_users_client_id",
                        column: x => x.client_id,
                        principalTable: "users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "ix_client_consent_history_accepted_at_utc_desc",
                table: "client_consent_history",
                column: "accepted_at_utc",
                descending: new bool[0]);

            migrationBuilder.CreateIndex(
                name: "ix_client_consent_history_client_id",
                table: "client_consent_history",
                column: "client_id");

            migrationBuilder.CreateIndex(
                name: "ix_client_consent_history_policy_version",
                table: "client_consent_history",
                column: "policy_version");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "client_consent_history");

            migrationBuilder.DropColumn(
                name: "privacy_policy_accepted_at_utc",
                table: "users");

            migrationBuilder.DropColumn(
                name: "privacy_policy_accepted_from_ip",
                table: "users");

            migrationBuilder.DropColumn(
                name: "privacy_policy_version_accepted",
                table: "users");
        }
    }
}
