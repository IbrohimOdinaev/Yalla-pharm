using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using Yalla.Infrastructure;

#nullable disable

namespace Infrastructure.Migrations;

/// <inheritdoc />
[DbContext(typeof(AppDbContext))]
[Migration("20260525120000_OptimizeOneCOffersImport")]
public partial class OptimizeOneCOffersImport : Migration
{
  /// <inheritdoc />
  protected override void Up(MigrationBuilder migrationBuilder)
  {
    migrationBuilder.AddColumn<int>(
      name: "inserted_count",
      table: "one_c_import_runs",
      type: "integer",
      nullable: false,
      defaultValue: 0);

    migrationBuilder.AddColumn<int>(
      name: "unchanged_count",
      table: "one_c_import_runs",
      type: "integer",
      nullable: false,
      defaultValue: 0);

    migrationBuilder.CreateIndex(
      name: "ix_offers_pharmacy_id_medicine_id",
      table: "offers",
      columns: new[] { "pharmacy_id", "medicine_id" });

    migrationBuilder.CreateIndex(
      name: "ix_one_c_import_runs_source_signature_status",
      table: "one_c_import_runs",
      columns: new[] { "source_id", "file_signature", "status" });
  }

  /// <inheritdoc />
  protected override void Down(MigrationBuilder migrationBuilder)
  {
    migrationBuilder.DropIndex(
      name: "ix_offers_pharmacy_id_medicine_id",
      table: "offers");

    migrationBuilder.DropIndex(
      name: "ix_one_c_import_runs_source_signature_status",
      table: "one_c_import_runs");

    migrationBuilder.DropColumn(
      name: "inserted_count",
      table: "one_c_import_runs");

    migrationBuilder.DropColumn(
      name: "unchanged_count",
      table: "one_c_import_runs");
  }
}
