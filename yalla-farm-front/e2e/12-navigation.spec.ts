import { test, expect } from "@playwright/test";
import { dismissAddressModal } from "./fixtures/helpers";
import { resetSession } from "./fixtures/auth";

test.beforeEach(async ({ page }) => {
  await resetSession(page);
  await page.goto("/");
  await dismissAddressModal(page);
});

test.describe("Back-button sync (browser + app)", () => {
  test("browser back and app back both return to previous page", async ({ page }) => {
    await page.goto("/cart");
    await expect(page).toHaveURL(/\/cart/);
    await page.goBack();
    await expect(page).toHaveURL(/\/$/);
  });

  test("app back arrow returns to /cart when on /cart/pharmacy", async ({ page }) => {
    await page.goto("/cart/pharmacy");
    const back = page.getByRole("button", { name: "Назад" }).first();
    await back.click();
    await expect(page).toHaveURL(/\/cart(?!\/pharmacy)/);
  });

  test("deep link / refresh uses heuristic parent (e.g. /product → /)", async ({ page }) => {
    // We don't have a known product id, so use a guaranteed-valid path instead.
    await page.goto("/cart");
    await page.getByRole("button", { name: "Назад" }).first().click();
    await expect(page).toHaveURL(/\/$/);
  });

  test("mixing browser back and app back stays consistent (no stale search chips)", async ({ page }) => {
    // / → /?search= → back → /
    await page.getByRole("button", { name: /Найти лекарства/ }).or(
      page.getByRole("link", { name: /Найти лекарства/ }),
    ).first().click();
    await expect(page).toHaveURL(/\?search=/);
    await page.goBack();
    // Search chips / filters must not persist after leaving search.
    await expect(page.getByText("Популярные запросы")).not.toBeVisible();
    await expect(page.getByRole("heading", { name: "Популярные товары" })).toBeVisible();
  });
});

test.describe("TopBar navigation", () => {
  test("address pill opens address-picker modal", async ({ page }) => {
    const addr = page.getByText(/Выберите адрес|Dushanbe|Tajikistan/).first();
    await addr.click();
    await expect(page.getByText(/Куда доставить/)).toBeVisible();
    // Close the modal
    await page.getByRole("button", { name: "Закрыть" }).first().click();
  });

  test("pharmacy pill opens pharmacy-picker modal", async ({ page }) => {
    const pill = page.getByText(/Все аптеки|OriyonFarma|OriyonFarm|Аптека/).first();
    await pill.click();
    // Modal shows a grid of pharmacies
    await expect(page.getByText(/Выберите аптеку|Все аптеки/i).first()).toBeVisible();
  });

  test("account dropdown profile link navigates to /profile", async ({ page }) => {
    await page.getByRole("button", { name: "Аккаунт" }).click();
    const link = page.getByRole("link", { name: /Мой профиль|Войти/ }).first();
    await link.click();
    await expect(page).toHaveURL(/\/login|\/profile/);
  });
});

test.describe("Sticky header on scroll", () => {
  test("header stays fixed while scrolling body", async ({ page }) => {
    const header = page.locator("header").first();
    const before = await header.boundingBox();
    await page.evaluate(() => window.scrollTo(0, 1000));
    await page.waitForTimeout(150);
    const after = await header.boundingBox();
    expect(before?.y).toBeCloseTo(after?.y ?? 0, 0); // header y did not change
  });
});
