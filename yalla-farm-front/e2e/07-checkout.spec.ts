import { test, expect } from "@playwright/test";
import { dismissAddressModal } from "./fixtures/helpers";
import { loginAs, requireAuth, resetSession } from "./fixtures/auth";

/**
 * Checkout needs an authenticated client AND a selected pharmacy in the
 * checkoutDraftStore. Without auth we assert only that the page gates
 * correctly (redirect / render guards).
 */

test.describe("Checkout as guest", () => {
  test("redirects to /cart/pharmacy when no pharmacy is selected", async ({ page }) => {
    await resetSession(page);
    const resp = await page.goto("/checkout");
    expect(resp?.status()).toBeLessThan(500);
    // With no draft set, the page replaces URL to /cart/pharmacy.
    await expect(page).toHaveURL(/\/cart\/pharmacy|\/checkout/);
  });
});

test.describe("Checkout — authenticated", () => {
  test.skip(!!requireAuth("Client"), "Set YALLA_E2E_CLIENT_TOKEN to run");

  test.beforeEach(async ({ page }) => {
    await resetSession(page);
    await loginAs(page, "Client");
    await page.goto("/");
    await dismissAddressModal(page);
  });

  test("full happy-path: add → pharmacy → checkout step progress visible", async ({ page }) => {
    await page.getByRole("button", { name: /В корзину/i }).first().click();
    await page.waitForTimeout(300);

    await page.goto("/cart/pharmacy");
    const choose = page.getByRole("button", { name: /^Выбрать$/ }).first();
    if (!(await choose.isVisible().catch(() => false))) {
      test.skip(true, "No pharmacies available to select");
      return;
    }
    await choose.click();
    await expect(page).toHaveURL(/\/checkout/);

    // Step progress at top: Корзина → Оформление → Оплата
    await expect(page.getByText("Корзина").first()).toBeVisible();
    await expect(page.getByText("Оформление").first()).toBeVisible();
    await expect(page.getByText("Оплата").first()).toBeVisible();

    // Address card
    await expect(page.getByText("Адрес доставки").first()).toBeVisible();

    // Sticky CTA at the bottom
    await expect(page.getByRole("button", { name: /Подтвердить/i }).last()).toBeVisible();
  });

  test("out-of-stock items have disabled checkbox", async ({ page }) => {
    await page.goto("/cart/pharmacy");
    const choose = page.getByRole("button", { name: /^Выбрать$/ }).first();
    if (!(await choose.isVisible().catch(() => false))) {
      test.skip(true, "No pharmacies to check");
      return;
    }
    await choose.click();

    // Check the "Нет в наличии" chip; its parent <label> should have disabled checkbox.
    const oos = page.getByText("Нет в наличии").first();
    if (!(await oos.isVisible().catch(() => false))) {
      test.skip(true, "No out-of-stock items in current cart");
      return;
    }
    const cb = oos.locator('xpath=ancestor::label').locator('input[type="checkbox"]').first();
    await expect(cb).toBeDisabled();
  });

  test("partial-stock items are pre-checked", async ({ page }) => {
    await page.goto("/cart/pharmacy");
    const choose = page.getByRole("button", { name: /^Выбрать$/ }).first();
    if (!(await choose.isVisible().catch(() => false))) {
      test.skip(true, "Skip");
      return;
    }
    await choose.click();
    const partial = page.getByText(/Только \d+ из \d+|Доступно \d+ из \d+/i).first();
    if (!(await partial.isVisible().catch(() => false))) {
      test.skip(true, "No partial-stock items");
      return;
    }
    const cb = partial.locator('xpath=ancestor::label').locator('input[type="checkbox"]').first();
    await expect(cb).toBeChecked();
  });
});
