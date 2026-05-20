using System;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using Yalla.Infrastructure;

#nullable disable

namespace Infrastructure.Migrations
{
    [DbContext(typeof(AppDbContext))]
    [Migration("20260519111000_AddOneCIntegrationLinks")]
    public partial class AddOneCIntegrationLinks : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "integration_sources",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    pharmacy_id = table.Column<Guid>(type: "uuid", nullable: false),
                    type = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    token = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: false),
                    name = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: false),
                    is_active = table.Column<bool>(type: "boolean", nullable: false, defaultValue: true),
                    created_at_utc = table.Column<DateTime>(type: "timestamp without time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_integration_sources", x => x.id);
                    table.ForeignKey(
                        name: "FK_integration_sources_pharmacies_pharmacy_id",
                        column: x => x.pharmacy_id,
                        principalTable: "pharmacies",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "medicine_barcodes",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    medicine_id = table.Column<Guid>(type: "uuid", nullable: false),
                    barcode = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    is_verified = table.Column<bool>(type: "boolean", nullable: false, defaultValue: false),
                    created_at_utc = table.Column<DateTime>(type: "timestamp without time zone", nullable: false),
                    last_seen_at_utc = table.Column<DateTime>(type: "timestamp without time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_medicine_barcodes", x => x.id);
                    table.ForeignKey(
                        name: "FK_medicine_barcodes_medicines_medicine_id",
                        column: x => x.medicine_id,
                        principalTable: "medicines",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "external_product_links",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    source_id = table.Column<Guid>(type: "uuid", nullable: false),
                    pharmacy_id = table.Column<Guid>(type: "uuid", nullable: false),
                    source_type = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    external_product_id = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: false),
                    external_barcode = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: true),
                    external_title = table.Column<string>(type: "character varying(512)", maxLength: 512, nullable: true),
                    medicine_id = table.Column<Guid>(type: "uuid", nullable: true),
                    match_status = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    match_method = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    confidence = table.Column<decimal>(type: "numeric(5,4)", precision: 5, scale: 4, nullable: true),
                    first_seen_at_utc = table.Column<DateTime>(type: "timestamp without time zone", nullable: false),
                    last_seen_at_utc = table.Column<DateTime>(type: "timestamp without time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_external_product_links", x => x.id);
                    table.ForeignKey(
                        name: "FK_external_product_links_integration_sources_source_id",
                        column: x => x.source_id,
                        principalTable: "integration_sources",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_external_product_links_medicines_medicine_id",
                        column: x => x.medicine_id,
                        principalTable: "medicines",
                        principalColumn: "id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_external_product_links_pharmacies_pharmacy_id",
                        column: x => x.pharmacy_id,
                        principalTable: "pharmacies",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "one_c_import_runs",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    source_id = table.Column<Guid>(type: "uuid", nullable: false),
                    file_kind = table.Column<string>(type: "character varying(16)", maxLength: 16, nullable: false),
                    file_name = table.Column<string>(type: "character varying(512)", maxLength: 512, nullable: false),
                    file_size = table.Column<long>(type: "bigint", nullable: false),
                    file_signature = table.Column<string>(type: "character varying(700)", maxLength: 700, nullable: false),
                    status = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    processed_count = table.Column<int>(type: "integer", nullable: false),
                    linked_count = table.Column<int>(type: "integer", nullable: false),
                    updated_count = table.Column<int>(type: "integer", nullable: false),
                    unmatched_count = table.Column<int>(type: "integer", nullable: false),
                    error = table.Column<string>(type: "text", nullable: true),
                    started_at_utc = table.Column<DateTime>(type: "timestamp without time zone", nullable: false),
                    finished_at_utc = table.Column<DateTime>(type: "timestamp without time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_one_c_import_runs", x => x.id);
                    table.ForeignKey(
                        name: "FK_one_c_import_runs_integration_sources_source_id",
                        column: x => x.source_id,
                        principalTable: "integration_sources",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "ix_external_product_links_external_barcode",
                table: "external_product_links",
                column: "external_barcode");

            migrationBuilder.CreateIndex(
                name: "ix_external_product_links_medicine_id",
                table: "external_product_links",
                column: "medicine_id",
                filter: "medicine_id IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "ix_external_product_links_pharmacy_source_external_id",
                table: "external_product_links",
                columns: new[] { "pharmacy_id", "source_type", "external_product_id" });

            migrationBuilder.CreateIndex(
                name: "ux_external_product_links_source_id_external_product_id",
                table: "external_product_links",
                columns: new[] { "source_id", "external_product_id" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_integration_sources_pharmacy_id_type",
                table: "integration_sources",
                columns: new[] { "pharmacy_id", "type" });

            migrationBuilder.CreateIndex(
                name: "ux_integration_sources_token",
                table: "integration_sources",
                column: "token",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_medicine_barcodes_barcode",
                table: "medicine_barcodes",
                column: "barcode");

            migrationBuilder.CreateIndex(
                name: "ux_medicine_barcodes_medicine_id_barcode",
                table: "medicine_barcodes",
                columns: new[] { "medicine_id", "barcode" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_one_c_import_runs_source_id_file_signature",
                table: "one_c_import_runs",
                columns: new[] { "source_id", "file_signature" });

            migrationBuilder.CreateIndex(
                name: "ix_one_c_import_runs_source_kind_started",
                table: "one_c_import_runs",
                columns: new[] { "source_id", "file_kind", "started_at_utc" });
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(name: "external_product_links");
            migrationBuilder.DropTable(name: "medicine_barcodes");
            migrationBuilder.DropTable(name: "one_c_import_runs");
            migrationBuilder.DropTable(name: "integration_sources");
        }
    }
}
