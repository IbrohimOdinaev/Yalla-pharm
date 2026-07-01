using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddPublicIdsForOrdersAndPrescriptions : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
                ALTER TABLE prescriptions ADD COLUMN public_id integer;
                CREATE SEQUENCE prescriptions_public_id_seq AS integer OWNED BY prescriptions.public_id;
                UPDATE prescriptions SET public_id = nextval('prescriptions_public_id_seq');
                ALTER TABLE prescriptions ALTER COLUMN public_id SET DEFAULT nextval('prescriptions_public_id_seq');
                ALTER TABLE prescriptions ALTER COLUMN public_id SET NOT NULL;
                SELECT setval('prescriptions_public_id_seq', GREATEST((SELECT COALESCE(MAX(public_id), 0) FROM prescriptions), 1), true);
                """);

            migrationBuilder.Sql("""
                ALTER TABLE orders ADD COLUMN public_id integer;
                CREATE SEQUENCE orders_public_id_seq AS integer OWNED BY orders.public_id;
                UPDATE orders SET public_id = nextval('orders_public_id_seq');
                ALTER TABLE orders ALTER COLUMN public_id SET DEFAULT nextval('orders_public_id_seq');
                ALTER TABLE orders ALTER COLUMN public_id SET NOT NULL;
                SELECT setval('orders_public_id_seq', GREATEST((SELECT COALESCE(MAX(public_id), 0) FROM orders), 1), true);
                """);

            migrationBuilder.CreateIndex(
                name: "ux_prescriptions_public_id",
                table: "prescriptions",
                column: "public_id",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ux_orders_public_id",
                table: "orders",
                column: "public_id",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "ux_prescriptions_public_id",
                table: "prescriptions");

            migrationBuilder.DropIndex(
                name: "ux_orders_public_id",
                table: "orders");

            migrationBuilder.DropColumn(
                name: "public_id",
                table: "prescriptions");

            migrationBuilder.DropColumn(
                name: "public_id",
                table: "orders");
        }
    }
}
