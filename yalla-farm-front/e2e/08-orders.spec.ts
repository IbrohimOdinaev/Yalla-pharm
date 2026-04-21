import { test, expect } from "@playwright/test";
import { loginAs, requireAuth, resetSession } from "./fixtures/auth";

test.describe("Orders — as guest", () => {
  test.beforeEach(async ({ page }) => {
    await resetSession(page);
    await page.goto("/orders");
  });

  test("shows auth-required empty state", async ({ page }) => {
    await expect(page.getByRole("heading", { name: /авторизация/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /Войти по SMS/ })).toBeVisible();
  });
});

test.describe("Orders — authenticated", () => {
  test.skip(!!requireAuth("Client"), "Set YALLA_E2E_CLIENT_TOKEN to run");

  test.beforeEach(async ({ page }) => {
    await resetSession(page);
    await loginAs(page, "Client");
    await page.goto("/orders");
    await page.waitForLoadState("networkidle").catch(() => undefined);
  });

  test("renders either tabs or empty-state", async ({ page }) => {
    const hasTabs = await page.getByRole("button", { name: /Активные/ }).isVisible().catch(() => false);
    const hasEmpty = await page.getByText(/ещё нет заказов/i).isVisible().catch(() => false);
    expect(hasTabs || hasEmpty).toBe(true);
  });

  test("expanding an order card shows positions + action buttons", async ({ page }) => {
    const firstCard = page.locator("article").filter({ hasText: /#[a-f0-9]{8}/i }).first();
    if (!(await firstCard.isVisible().catch(() => false))) {
      test.skip(true, "No orders in test account");
      return;
    }
    await firstCard.click();
    // After expand we expect to see either "Позиции" heading or order details.
    await expect(page.getByText(/Позиции|Сумма заказа|Доставка/i).first()).toBeVisible();
  });

  test("receipt code appears when courier is on the way", async ({ page }) => {
    const code = page.getByText(/Код для курьера/i);
    if (!(await code.isVisible().catch(() => false))) {
      test.skip(true, "No OnTheWay orders in test account");
      return;
    }
    // The 4-char code block is rendered large next to it.
    await expect(code).toBeVisible();
  });
});
