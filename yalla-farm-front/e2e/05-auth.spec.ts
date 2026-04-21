import { test, expect } from "@playwright/test";
import { resetSession } from "./fixtures/auth";

test.beforeEach(async ({ page }) => {
  await resetSession(page);
});

test.describe("Client login — UI structure", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
  });

  test("shows welcome hero, phone input, primary + Telegram buttons", async ({ page }) => {
    await expect(page.getByRole("heading", { name: "Добро пожаловать" })).toBeVisible();
    await expect(page.getByPlaceholder(/\+\+\+\+|93\s*/)).toBeVisible();
    await expect(page.getByRole("button", { name: /Получить код/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /Войти через Telegram/i })).toBeVisible();
  });

  test("+992 prefix is hardcoded; input accepts only digits", async ({ page }) => {
    const input = page.getByPlaceholder(/93\s*/);
    await input.fill("abc123def456");
    // Only digits should remain, max 9 chars.
    const val = await input.inputValue();
    expect(val).toMatch(/^\d{0,9}$/);
  });

  test("submitting with short phone shows validation error", async ({ page }) => {
    await page.getByPlaceholder(/93\s*/).fill("123");
    await page.getByRole("button", { name: /Получить код/ }).click();
    await expect(page.getByText(/9 цифр/i)).toBeVisible({ timeout: 5_000 });
  });

  test("bonus/benefit chips are visible", async ({ page }) => {
    await expect(page.getByText(/Быстрая регистрация/i)).toBeVisible();
    await expect(page.getByText(/Безопасно/i)).toBeVisible();
    await expect(page.getByText(/Бонус/i)).toBeVisible();
  });

  test("admin login link is present at the bottom", async ({ page }) => {
    const adminLink = page.getByRole("link", { name: /Вход для администратора/i });
    await expect(adminLink).toBeVisible();
    await adminLink.click();
    await expect(page).toHaveURL(/\/login\/admin/);
  });
});

test.describe("Admin login — UI structure", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/login/admin");
  });

  test("role tabs Admin/SuperAdmin are visible and toggleable", async ({ page }) => {
    const adminTab = page.getByRole("button", { name: /^Администратор$/ });
    const superTab = page.getByRole("button", { name: /^Суперадмин$/ });
    await expect(adminTab).toBeVisible();
    await expect(superTab).toBeVisible();

    await superTab.click();
    await expect(page.getByRole("button", { name: /Войти как суперадмин/ })).toBeVisible();

    await adminTab.click();
    await expect(page.getByRole("button", { name: /Войти как администратор/ })).toBeVisible();
  });

  test("password eye-toggle hides/shows password", async ({ page }) => {
    const pwd = page.locator('input[type="password"], input[type="text"]').nth(1);
    await pwd.fill("secret123");
    expect(await pwd.getAttribute("type")).toBe("password");

    const toggle = page.getByRole("button", { name: "Показать пароль" });
    await toggle.click();
    expect(await pwd.getAttribute("type")).toBe("text");
  });

  test("back link to client login exists", async ({ page }) => {
    await expect(page.getByRole("link", { name: /SMS-код/ })).toBeVisible();
  });
});

test.describe("Register page", () => {
  test("shows SMS-redirect notice and CTA to /login", async ({ page }) => {
    await page.goto("/register");
    await expect(page.getByRole("heading", { name: "Регистрация теперь по SMS" })).toBeVisible();
    await expect(page.getByRole("link", { name: /Перейти ко входу/ })).toBeVisible();
  });
});

test.describe("Profile page as guest", () => {
  test("shows login-required empty state, not the profile form", async ({ page }) => {
    await page.goto("/profile");
    await expect(page.getByRole("heading", { name: /авторизация/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /Войти по SMS/ })).toBeVisible();
  });
});
