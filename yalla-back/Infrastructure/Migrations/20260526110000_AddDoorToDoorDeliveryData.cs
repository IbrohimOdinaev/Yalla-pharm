using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using Yalla.Infrastructure;

#nullable disable

namespace Infrastructure.Migrations;

/// <inheritdoc />
[DbContext(typeof(AppDbContext))]
[Migration("20260526110000_AddDoorToDoorDeliveryData")]
public partial class AddDoorToDoorDeliveryData : Migration
{
  /// <inheritdoc />
  protected override void Up(MigrationBuilder migrationBuilder)
  {
    migrationBuilder.AddColumn<string>(
      name: "courier_details",
      table: "delivery_data",
      type: "character varying(1024)",
      maxLength: 1024,
      nullable: true);

    migrationBuilder.AddColumn<bool>(
      name: "deliver_to_door",
      table: "delivery_data",
      type: "boolean",
      nullable: false,
      defaultValue: false);
  }

  /// <inheritdoc />
  protected override void Down(MigrationBuilder migrationBuilder)
  {
    migrationBuilder.DropColumn(
      name: "courier_details",
      table: "delivery_data");

    migrationBuilder.DropColumn(
      name: "deliver_to_door",
      table: "delivery_data");
  }
}
