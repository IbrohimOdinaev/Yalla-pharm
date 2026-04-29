using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class RemoveDeprecatedCategories : Migration
    {
        // Categories the business decided to drop from the catalog. Their
        // medicines should disappear from the storefront too.
        //
        // We can't physically delete the medicines because they may be
        // referenced by basket_positions / order_positions / payment_intent_positions
        // (FKs are RESTRICT to preserve order history). Instead we soft-delete
        // by flipping is_active = false — catalog/search filters skip them.
        // The categories themselves we hard-delete; the FK from medicines
        // is ON DELETE SET NULL so leftover medicine rows simply lose their
        // category_id (already irrelevant since they're inactive).
        //
        // Idempotent: re-running on a DB that already has the rows missing
        // is a no-op (DELETE just affects 0 rows).

        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // 1. Soft-delete medicines whose category is one of the four
            //    deprecated parents OR a direct child of "Анализы на дому"
            //    (which has 25 sub-categories carrying its products).
            migrationBuilder.Sql(@"
                UPDATE medicines
                SET is_active = false
                WHERE category_id IN (
                    SELECT id FROM categories
                    WHERE name IN ('Ортопедия', 'Анализы на дому', 'Детское питание', 'Оптика')
                )
                OR category_id IN (
                    SELECT id FROM categories
                    WHERE parent_id IN (
                        SELECT id FROM categories WHERE name = 'Анализы на дому'
                    )
                );
            ");

            // 2. Delete sub-categories of "Анализы на дому" first. Their
            //    medicines have category_id reset to NULL by the FK.
            migrationBuilder.Sql(@"
                DELETE FROM categories
                WHERE parent_id IN (
                    SELECT id FROM categories WHERE name = 'Анализы на дому'
                );
            ");

            // 3. Delete the four root deprecated categories themselves.
            migrationBuilder.Sql(@"
                DELETE FROM categories
                WHERE name IN ('Ортопедия', 'Анализы на дому', 'Детское питание', 'Оптика');
            ");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // Down is intentionally a no-op. Re-creating the categories with
            // the same ids/slugs/wcIds isn't reliable from a schema migration
            // (those values were imported, not generated here). If a rollback
            // is ever needed, do a fresh reseed from WooCommerce instead.
        }
    }
}
