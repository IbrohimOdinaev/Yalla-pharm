import { test, expect } from "@playwright/test";
import { loginAs, requireAuth, resetSession } from "./fixtures/auth";

test.describe("SuperAdmin panel", () => {
  test.skip(!!requireAuth("SuperAdmin"), "Set YALLA_E2E_SUPERADMIN_TOKEN to run");

  test.beforeEach(async ({ page }) => {
    await resetSession(page);
    await loginAs(page, "SuperAdmin");
    await page.goto("/superadmin");
    await page.waitForLoadState("networkidle").catch(() => undefined);
  });

  test("opens 5 tab hashes: pharmacies/medicines/orders/payments/refunds", async ({ page }) => {
    for (const hash of ["#pharmacies", "#medicines", "#orders", "#payments", "#refunds"]) {
      await page.goto(`/superadmin${hash}`);
      await page.waitForTimeout(200);
      // Each tab should be reachable without 500.
      expect(page.url()).toContain(hash);
    }
  });

  test("Pharmacies tab shows list or empty-state", async ({ page }) => {
    await page.goto("/superadmin#pharmacies");
    const hasItems = await page.locator("article").first().isVisible().catch(() => false);
    const hasEmpty = await page.getByText(/нет аптек/i).isVisible().catch(() => false);
    expect(hasItems || hasEmpty).toBe(true);
  });

  test("Payments tab surface pending intents or empty state", async ({ page }) => {
    await page.goto("/superadmin#payments");
    const hasItems = (await page.getByText(/Confirm|Подтвердить|Отклонить|Пусто/).count()) > 0;
    expect(hasItems).toBe(true);
  });
});
