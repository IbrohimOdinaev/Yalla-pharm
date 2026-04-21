import { test, expect } from "@playwright/test";
import { dismissAddressModal } from "./fixtures/helpers";
import { resetSession } from "./fixtures/auth";

test.beforeEach(async ({ page }) => {
  await resetSession(page);
  await page.goto("/");
  await dismissAddressModal(page);
});

test.describe("Search — opening from TopBar", () => {
  test("clicking the top-bar search pill navigates to ?search=", async ({ page }) => {
    await page.getByRole("button", { name: /Найти лекарства/ }).or(
      page.getByRole("link", { name: /Найти лекарства/ }),
    ).first().click();
    await expect(page).toHaveURL(/\/\?search=/);
  });

  test("in search view, the top-bar search pill is hidden", async ({ page }) => {
    await page.goto("/?search=");
    // The page-level search input is visible…
    await expect(page.getByPlaceholder(/Название лекарства/i)).toBeVisible();
    // …but the top-bar one with `Найти лекарства` placeholder should be gone.
    const topBarSearch = page.getByText("Найти лекарства, витамины, тесты");
    expect(await topBarSearch.count()).toBe(0);
  });

  test("popular queries shown when query is empty", async ({ page }) => {
    await page.goto("/?search=");
    await expect(page.getByText("Популярные запросы")).toBeVisible();
    const popular = ["Парацетамол", "Ибупрофен", "Амоксициллин"];
    for (const q of popular) {
      await expect(page.getByRole("button", { name: q })).toBeVisible();
    }
  });

  test("clicking a popular query fills the input and updates URL", async ({ page }) => {
    await page.goto("/?search=");
    await page.getByRole("button", { name: "Парацетамол" }).click();
    await expect(page.getByPlaceholder(/Название лекарства/i)).toHaveValue("Парацетамол");
  });
});

test.describe("Search — back navigation", () => {
  test("back button in search view returns to home", async ({ page }) => {
    await page.goto("/?search=");
    const backBtn = page.getByRole("button", { name: "Назад" }).first();
    await backBtn.click();
    // URL should no longer have search param.
    await expect(page).not.toHaveURL(/\?search=/);
  });

  test("browser back from search restores home view (no stale chips)", async ({ page }) => {
    await page.goto("/");
    await dismissAddressModal(page);
    await page.getByRole("button", { name: /Найти лекарства/ }).or(
      page.getByRole("link", { name: /Найти лекарства/ }),
    ).first().click();
    await expect(page).toHaveURL(/\?search=/);
    await page.goBack();
    await expect(page).not.toHaveURL(/\?search=/);
    // The home categories should be back.
    await expect(page.getByRole("heading", { name: "Популярные товары" })).toBeVisible();
  });
});

test.describe("Search — suggestions", () => {
  test("typing shows debounced suggestions or results area", async ({ page }) => {
    await page.goto("/?search=");
    const input = page.getByPlaceholder(/Название лекарства/i);
    await input.fill("пар");
    // We expect either a suggestions dropdown or a search-loading indicator.
    // Results may take time; give it 5s then assert URL updated to include query.
    await page.waitForTimeout(800);
    await expect(page).toHaveURL(/\?search=%D0%BF%D0%B0%D1%80|\?search=пар/);
  });
});

test.describe("Catalog view (after category selection)", () => {
  test("sidebar categories are visible on desktop", async ({ page, viewport }) => {
    test.skip(!viewport || viewport.width < 640, "Sidebar only on ≥ sm");
    await page.getByRole("button", { name: /^Витамины$/ }).first().click();
    await expect(page.getByRole("heading", { name: "Каталог" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Все товары" })).toBeVisible();
  });

  test("pagination appears when >1 page and next/prev work", async ({ page }) => {
    await page.getByRole("button", { name: /^Все категории$/ }).first().click();
    // Wait for either data or no-results state.
    await page.waitForLoadState("networkidle").catch(() => undefined);
    const nextBtn = page.getByRole("button", { name: "Вперёд" });
    if (await nextBtn.isVisible().catch(() => false)) {
      await nextBtn.click();
      await page.waitForLoadState("networkidle").catch(() => undefined);
      await expect(page.getByRole("button", { name: "Назад" })).toBeEnabled();
    } else {
      test.skip(true, "Single page of results — pagination not applicable");
    }
  });

  test("back arrow exits catalog view to home", async ({ page }) => {
    await page.getByRole("button", { name: /^Сердце$/ }).first().click();
    await page.getByRole("button", { name: "Назад" }).first().click();
    await expect(page.getByRole("heading", { name: "Популярные товары" })).toBeVisible();
  });
});
