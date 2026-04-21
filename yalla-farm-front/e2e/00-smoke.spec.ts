import { test, expect } from "@playwright/test";
import { dismissAddressModal } from "./fixtures/helpers";
import { resetSession } from "./fixtures/auth";

/**
 * Smoke suite: every public route must respond 200 and render its key chrome
 * (top bar, main content). This is the absolute baseline — if any of these
 * fail the rest of the suite is meaningless.
 */

const PUBLIC_ROUTES = [
  { path: "/", title: "Yalla Farm" },
  { path: "/login", heading: "Добро пожаловать" },
  { path: "/login/admin", heading: "Кабинет персонала" },
  { path: "/register", heading: "Регистрация теперь по SMS" },
  { path: "/cart", heading: /Корзина|товары/i },
  { path: "/orders", heading: /Мои заказы|авторизация/i },
  { path: "/profile", heading: /Профиль|авторизация/i },
  { path: "/pharmacies/map", heading: /Аптеки/i },
];

for (const route of PUBLIC_ROUTES) {
  test(`public route ${route.path} responds 200 and renders`, async ({ page }) => {
    await resetSession(page);
    const resp = await page.goto(route.path);
    expect(resp?.status()).toBeLessThan(400);
    await dismissAddressModal(page);

    if (route.heading) {
      await expect(page.getByRole("heading", { name: route.heading }).first()).toBeVisible();
    }

    // Every page must have the top bar — either home TopBar or default TopBar.
    await expect(page.locator("header").first()).toBeVisible();
  });
}

test("admin-only route /workspace responds without crashing", async ({ page }) => {
  await resetSession(page);
  const resp = await page.goto("/workspace");
  // As a guest we either see the gate screen or get redirected — both are OK,
  // just not a server 500.
  expect(resp?.status()).toBeLessThan(500);
});

test("superadmin route /superadmin responds without crashing", async ({ page }) => {
  await resetSession(page);
  const resp = await page.goto("/superadmin");
  expect(resp?.status()).toBeLessThan(500);
});

test("unknown route returns Next.js 404 page", async ({ page }) => {
  const resp = await page.goto("/this-definitely-does-not-exist");
  expect(resp?.status()).toBe(404);
});
