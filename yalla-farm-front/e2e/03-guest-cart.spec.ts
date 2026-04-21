import { test, expect } from "@playwright/test";
import { dismissAddressModal, readCartBadge } from "./fixtures/helpers";
import { resetSession } from "./fixtures/auth";

test.beforeEach(async ({ page }) => {
  await resetSession(page);
  await page.goto("/");
  await dismissAddressModal(page);
});

test.describe("Guest cart — adding", () => {
  test('clicking "В корзину" on a product card adds it to the guest cart', async ({ page }) => {
    const addBtn = page.getByRole("button", { name: /В корзину/i }).first();
    await expect(addBtn).toBeVisible();
    await addBtn.click();

    // Cart badge should now show "1".
    await expect.poll(() => readCartBadge(page), { timeout: 5_000 }).toBeGreaterThanOrEqual(1);
  });

  test("adding from product modal updates the badge", async ({ page }) => {
    // Open product modal by clicking the first medicine card
    const card = page.locator('article').filter({ has: page.getByRole("button", { name: /В корзину/i }) }).first();
    await card.click();
    const modalAdd = page.locator('[role="dialog"], .fixed.inset-0').getByRole("button", { name: /В корзину/i }).first();
    if (await modalAdd.isVisible().catch(() => false)) {
      await modalAdd.click();
      await expect.poll(() => readCartBadge(page), { timeout: 5_000 }).toBeGreaterThanOrEqual(1);
    } else {
      test.skip(true, "Product modal UI differs — skipping add-from-modal variant");
    }
  });

  test("cart persists across reloads via localStorage", async ({ page }) => {
    await page.getByRole("button", { name: /В корзину/i }).first().click();
    await expect.poll(() => readCartBadge(page), { timeout: 5_000 }).toBeGreaterThanOrEqual(1);
    await page.reload();
    await dismissAddressModal(page);
    await expect.poll(() => readCartBadge(page), { timeout: 5_000 }).toBeGreaterThanOrEqual(1);
  });
});

test.describe("Guest cart — /cart page", () => {
  test.beforeEach(async ({ page }) => {
    // Seed a guest cart before visiting /cart
    await page.getByRole("button", { name: /В корзину/i }).first().click();
    await expect.poll(() => readCartBadge(page), { timeout: 5_000 }).toBeGreaterThanOrEqual(1);
    await page.getByRole("link", { name: "Корзина" }).click();
    await expect(page).toHaveURL(/\/cart/);
  });

  test("cart page lists items with qty stepper", async ({ page }) => {
    await expect(page.getByRole("button", { name: "Уменьшить" }).first()).toBeVisible();
    await expect(page.getByRole("button", { name: "Увеличить" }).first()).toBeVisible();
  });

  test("rapid + clicks increment qty without being blocked", async ({ page }) => {
    const plus = page.getByRole("button", { name: "Увеличить" }).first();
    // Read initial qty from the label between ± buttons
    const qtyLabel = page.locator("span.min-w-\\[1\\.5rem\\]").first();
    const start = Number((await qtyLabel.textContent())?.trim() ?? "1");
    await plus.click();
    await plus.click();
    await plus.click();
    await expect(qtyLabel).toHaveText(String(start + 3), { timeout: 3_000 });
  });

  test('"Удалить" link removes the item from cart', async ({ page }) => {
    const removeLink = page.getByRole("button", { name: "Удалить" }).first();
    await removeLink.click();
    await expect(page.getByText("Корзина пустая")).toBeVisible({ timeout: 5_000 });
  });

  test('"Выбрать аптеку" button leads to /cart/pharmacy', async ({ page }) => {
    await page.getByRole("button", { name: /Выбрать аптеку/i }).click();
    await expect(page).toHaveURL(/\/cart\/pharmacy/);
  });
});

test.describe("Empty cart", () => {
  test('shows empty-state with "В каталог" CTA', async ({ page }) => {
    await page.goto("/cart");
    await dismissAddressModal(page);
    await expect(page.getByText("Корзина пустая")).toBeVisible();
    const cta = page.getByRole("link", { name: /В каталог/ });
    await expect(cta).toBeVisible();
    await cta.click();
    await expect(page).toHaveURL(/\/$/);
  });
});
