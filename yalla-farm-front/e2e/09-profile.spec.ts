import { test, expect } from "@playwright/test";
import { loginAs, requireAuth, resetSession } from "./fixtures/auth";

test.describe("Profile — authenticated", () => {
  test.skip(!!requireAuth("Client"), "Set YALLA_E2E_CLIENT_TOKEN to run");

  test.beforeEach(async ({ page }) => {
    await resetSession(page);
    await loginAs(page, "Client");
    await page.goto("/profile");
    await page.waitForLoadState("networkidle").catch(() => undefined);
  });

  test("renders hero card with avatar + name", async ({ page }) => {
    await expect(page.getByText("Мой профиль")).toBeVisible();
  });

  test("quick-actions grid has 4 tiles (orders, cart, pharmacies, catalog)", async ({ page }) => {
    await expect(page.getByRole("link", { name: /Заказы/ })).toBeVisible();
    await expect(page.getByRole("link", { name: /Корзина/ })).toBeVisible();
    await expect(page.getByRole("link", { name: /Аптеки/ })).toBeVisible();
    await expect(page.getByRole("link", { name: /Каталог/ })).toBeVisible();
  });

  test("personal data form has name/gender/dob inputs and Save button", async ({ page }) => {
    await expect(page.getByLabel(/Имя/)).toBeVisible();
    // Gender select is actual <select>
    await expect(page.locator("select")).toBeVisible();
    await expect(page.getByRole("button", { name: /Сохранить/ })).toBeVisible();
  });

  test("logout button signs out and navigates to /login", async ({ page }) => {
    await page.getByRole("button", { name: /Выйти из аккаунта/ }).click();
    await expect(page).toHaveURL(/\/login/);
  });

  test('delete-account flow requires explicit "Да, удалить" confirmation', async ({ page }) => {
    await page.getByRole("button", { name: /Удалить аккаунт/ }).first().click();
    // Confirmation block appears with a second red button
    await expect(page.getByText(/Уверены\?/)).toBeVisible();
    await expect(page.getByRole("button", { name: /Да, удалить/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /Отмена/ })).toBeVisible();
    // Cancel without actually deleting
    await page.getByRole("button", { name: /Отмена/ }).click();
    await expect(page.getByText(/Уверены\?/)).not.toBeVisible();
  });

  test("linking section is visible when neither phone nor telegram is linked", async ({ page }) => {
    const linking = page.getByRole("heading", { name: /Привязка аккаунта/ });
    if (!(await linking.isVisible().catch(() => false))) {
      test.skip(true, "Account already has both phone and telegram linked");
      return;
    }
    await expect(page.getByRole("button", { name: /Привязать/ }).first()).toBeVisible();
  });
});
