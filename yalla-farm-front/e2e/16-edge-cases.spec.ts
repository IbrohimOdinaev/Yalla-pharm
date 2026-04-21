import { test, expect } from "@playwright/test";
import { resetSession } from "./fixtures/auth";
import { dismissAddressModal } from "./fixtures/helpers";

/**
 * Network / empty / error states the app must handle gracefully.
 */

test.describe("API failure handling", () => {
  test("home still renders chrome even when medicine API is offline", async ({ page }) => {
    await resetSession(page);
    // Make every medicine/catalog API call fail with 500.
    await page.route("**/api/medicines**", (route) => route.fulfill({ status: 500, body: "{}" }));
    await page.goto("/");
    await dismissAddressModal(page);

    // Categories still show (they come from /api/categories).
    await expect(page.getByRole("button", { name: "Боль и жар" }).first()).toBeVisible();
    // Header still works.
    await expect(page.getByAltText("Yalla").first()).toBeVisible();
  });

  test("catalog view shows error when fetch fails", async ({ page }) => {
    await resetSession(page);
    await page.route("**/api/medicines?*", (route) => route.fulfill({ status: 500, body: "{}" }));
    await page.goto("/");
    await dismissAddressModal(page);
    await page.getByRole("button", { name: /^Все категории$/ }).first().click();
    // "Ничего не найдено" or an error toast — either is acceptable.
    const err = page.getByText(/не удалось|ошибк|Ничего не найдено/i).first();
    await expect(err).toBeVisible({ timeout: 10_000 });
  });
});

test.describe("Empty states", () => {
  test("/cart without items shows empty cart hero", async ({ page }) => {
    await resetSession(page);
    await page.goto("/cart");
    await dismissAddressModal(page);
    await expect(page.getByText("Корзина пустая")).toBeVisible();
    await expect(page.getByRole("link", { name: /В каталог/ })).toBeVisible();
  });

  test("/orders without token shows auth gate", async ({ page }) => {
    await resetSession(page);
    await page.goto("/orders");
    await expect(page.getByRole("heading", { name: /авторизация/i })).toBeVisible();
  });
});

test.describe("Invalid inputs", () => {
  test("short phone in login shows validation error", async ({ page }) => {
    await resetSession(page);
    await page.goto("/login");
    await page.getByPlaceholder(/93\s*/).fill("12");
    await page.getByRole("button", { name: /Получить код/ }).click();
    await expect(page.getByText(/9 цифр/i)).toBeVisible();
  });
});

test.describe("SignalR guest behaviour", () => {
  test("guest visit does NOT trigger /hubs/updates requests", async ({ page }) => {
    await resetSession(page);
    const hubRequests: string[] = [];
    page.on("request", (req) => {
      if (req.url().includes("/hubs/")) hubRequests.push(req.url());
    });
    await page.goto("/");
    await dismissAddressModal(page);
    await page.waitForTimeout(2_000);
    expect(hubRequests).toEqual([]);
  });
});
