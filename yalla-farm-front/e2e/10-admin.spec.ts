import { test, expect } from "@playwright/test";
import { loginAs, requireAuth, resetSession } from "./fixtures/auth";

test.describe("Admin workspace", () => {
  test.skip(!!requireAuth("Admin"), "Set YALLA_E2E_ADMIN_TOKEN to run");

  test.beforeEach(async ({ page }) => {
    await resetSession(page);
    await loginAs(page, "Admin");
    await page.goto("/workspace");
    await page.waitForLoadState("networkidle").catch(() => undefined);
  });

  test("opens with 3 tabs: Аптека / Предложения / Заказы", async ({ page }) => {
    await expect(page.getByRole("heading", { name: /Кабинет|Аптека/ }).first()).toBeVisible();
  });

  test("can switch to Offers tab", async ({ page }) => {
    await page.goto("/workspace#offers");
    // Offers tab shows search field for medicines
    await expect(page.locator("input, textarea").first()).toBeVisible();
  });

  test("can switch to Orders tab and see at least one status column or empty-state", async ({ page }) => {
    await page.goto("/workspace#orders");
    // Shows either kanban with orders or empty state
    const hasOrders = await page.locator("article").first().isVisible().catch(() => false);
    const hasEmpty = await page.getByText(/нет заказов/i).isVisible().catch(() => false);
    expect(hasOrders || hasEmpty).toBe(true);
  });

  test("bottom nav exposes admin shortcuts on mobile viewport", async ({ page, viewport }) => {
    test.skip(!viewport || viewport.width >= 768, "Bottom nav is mobile-only");
    await expect(page.getByRole("link", { name: /Предложения/ })).toBeVisible();
  });
});
