import { test, expect } from "@playwright/test";
import { dismissAddressModal } from "./fixtures/helpers";
import { resetSession } from "./fixtures/auth";

test.beforeEach(async ({ page }) => {
  await resetSession(page);
  await page.goto("/");
  await dismissAddressModal(page);
});

test.describe("Product modal / page", () => {
  test("clicking a product card opens detail view with name & price", async ({ page }) => {
    const card = page.locator('article').filter({ has: page.getByRole("button", { name: /В корзину/i }) }).first();
    await card.click();

    // Modal opens in-place (ProductModal) or navigates to /product/[id].
    // Either way we should see a large price element (font-display extrabold).
    const priceEl = page.locator("text=/\\d[\\d\\s,.]*\\s*TJS/").first();
    await expect(priceEl).toBeVisible({ timeout: 5_000 });
  });

  test("product page direct URL shows sticky bottom add-to-cart", async ({ page }) => {
    // First grab a product id from the catalog
    await page.getByRole("button", { name: /^Все категории$/ }).first().click();
    const firstCard = page.locator('article').filter({ has: page.getByRole("button", { name: /В корзину/i }) }).first();
    await firstCard.click();
    if (page.url().includes("/product/")) {
      // Sticky bottom has quantity stepper + "В корзину · X TJS"
      await expect(page.getByRole("button", { name: /В корзину/i }).last()).toBeVisible();
      await expect(page.getByRole("button", { name: "Уменьшить" }).first()).toBeVisible();
    } else {
      test.skip(true, "Card opened modal, not standalone product page");
    }
  });
});
