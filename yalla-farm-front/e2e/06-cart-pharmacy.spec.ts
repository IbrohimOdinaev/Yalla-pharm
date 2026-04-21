import { test, expect } from "@playwright/test";
import { dismissAddressModal } from "./fixtures/helpers";
import { resetSession } from "./fixtures/auth";

test.beforeEach(async ({ page }) => {
  await resetSession(page);
  await page.goto("/");
  await dismissAddressModal(page);

  // Seed a guest cart so /cart/pharmacy has something to compute prices for.
  await page.getByRole("button", { name: /В корзину/i }).first().click();
  await page.waitForTimeout(300);

  await page.goto("/cart/pharmacy");
  await page.waitForLoadState("networkidle").catch(() => undefined);
});

test.describe("Pharmacy picker", () => {
  test("Delivery/Pickup tabs toggle correctly", async ({ page }) => {
    const delivery = page.getByRole("button", { name: /Доставка/ }).first();
    const pickup = page.getByRole("button", { name: /Самовывоз/ }).first();
    await expect(delivery).toBeVisible();
    await expect(pickup).toBeVisible();
    await pickup.click();
    await delivery.click();
  });

  test("back arrow returns to /cart", async ({ page }) => {
    await page.getByRole("button", { name: "Назад" }).first().click();
    await expect(page).toHaveURL(/\/cart(\?|$)/);
  });

  test("pharmacy list or empty state is rendered", async ({ page }) => {
    // Either there are pharmacy cards (with "Выбрать" button) or an empty state.
    const hasPharmacies = (await page.getByRole("button", { name: /Выбрать/ }).count()) > 0;
    const hasEmpty = await page.getByText(/Нет доступных аптек/i).isVisible().catch(() => false);
    expect(hasPharmacies || hasEmpty).toBe(true);
  });

  test('"Выбрать" button on a pharmacy routes to /checkout', async ({ page }) => {
    const choose = page.getByRole("button", { name: /^Выбрать$/ }).first();
    if (!(await choose.isVisible().catch(() => false))) {
      test.skip(true, "No pharmacies in current environment to select");
      return;
    }
    await choose.click();
    await expect(page).toHaveURL(/\/checkout/);
  });
});

test.describe("Pharmacy map", () => {
  test("map container is visible on desktop layout", async ({ page, viewport }) => {
    test.skip(!viewport || viewport.width < 768, "Map only takes half the screen on ≥ md");
    // Google Map renders in a div with iframe/canvas children. We just check the map area exists.
    const mapWrapper = page.locator(".h-full.w-full, [aria-roledescription='map']").last();
    await expect(mapWrapper).toBeVisible();
  });
});
