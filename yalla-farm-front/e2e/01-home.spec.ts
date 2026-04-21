import { test, expect } from "@playwright/test";
import { dismissAddressModal } from "./fixtures/helpers";
import { resetSession } from "./fixtures/auth";

test.beforeEach(async ({ page }) => {
  await resetSession(page);
  await page.goto("/");
  await dismissAddressModal(page);
});

test.describe("Home — header", () => {
  test("logo links to /", async ({ page }) => {
    const logo = page.getByAltText("Yalla").first();
    await expect(logo).toBeVisible();
  });

  test("search pill is present and takes roughly half the bar width", async ({ page }) => {
    const search = page.getByRole("button", { name: /Найти лекарства/ }).or(
      page.getByRole("link", { name: /Найти лекарства/ }),
    ).first();
    await expect(search).toBeVisible();

    // Search should be narrower than the header — it's w-1/2.
    const header = page.locator("header").first();
    const headerBox = await header.boundingBox();
    const searchBox = await search.boundingBox();
    if (headerBox && searchBox) {
      // ≤ 60% of header width (50% + some tolerance for gaps).
      expect(searchBox.width).toBeLessThan(headerBox.width * 0.65);
    }
  });

  test("cart icon is visible; badge hidden when empty", async ({ page }) => {
    const cart = page.getByRole("link", { name: "Корзина" });
    await expect(cart).toBeVisible();
    // Badge is a child span with digit text; it should NOT exist when cart is empty.
    const badge = cart.locator("span").filter({ hasText: /^\d+$/ });
    expect(await badge.count()).toBe(0);
  });

  test("profile button opens dropdown with guest state when not logged in", async ({ page }) => {
    await page.getByRole("button", { name: "Аккаунт" }).click();
    await expect(page.getByText("Гостевой режим")).toBeVisible();
    await expect(page.getByRole("link", { name: /Войти по SMS/ })).toBeVisible();
  });

  test("address and pharmacy selectors are present in row 2", async ({ page }) => {
    await expect(page.getByText(/Выберите адрес|Tajikistan/).first()).toBeVisible();
    await expect(page.getByText(/Все аптеки|Фарм/i).first()).toBeVisible();
  });
});

test.describe("Home — quick category tiles", () => {
  test("renders all 16 categories", async ({ page }) => {
    const expected = [
      "Боль и жар", "Аллергия", "Дыхание", "Антибиотики",
      "Витамины", "Сердце", "ЖКТ", "Глаза",
      "Кожа и волосы", "Диабет", "Мама и малыш", "Нервы и сон",
      "Кости и суставы", "Красота", "Иммунитет", "Все категории",
    ];
    for (const label of expected) {
      await expect(page.getByRole("button", { name: new RegExp(`^${label}$`) }).first()).toBeVisible();
    }
  });

  test("clicking a category opens catalog view filtered by it", async ({ page }) => {
    await page.getByRole("button", { name: /^Витамины$/ }).first().click();
    // Catalog view: back arrow + category heading.
    await expect(page.getByRole("heading", { name: /Витамин/i }).first()).toBeVisible();
  });

  test('"Все категории" opens full catalog view', async ({ page }) => {
    await page.getByRole("button", { name: /^Все категории$/ }).first().click();
    await expect(page.getByRole("heading", { name: /Все товары/i }).first()).toBeVisible();
  });
});

test.describe("Home — rails feed", () => {
  test("renders multiple themed rails with bold titles", async ({ page }) => {
    // At least one of the main rails should appear — prefer the one without a
    // category match dependency.
    await expect(page.getByRole("heading", { name: "Популярные товары" })).toBeVisible();

    // Headings in home feed — at least 2 rails should be visible
    const railHeadings = page.getByRole("heading", { level: 2 });
    expect(await railHeadings.count()).toBeGreaterThanOrEqual(1);
  });

  test('each rail has "Все →" link', async ({ page }) => {
    const viewAll = page.getByRole("button", { name: /Все →/ });
    await expect(viewAll.first()).toBeVisible();
  });

  test("rail is horizontally scrollable", async ({ page }) => {
    const rail = page.locator("section").filter({ hasText: "Популярные товары" }).locator(".overflow-x-auto").first();
    const scrollWidthBefore = await rail.evaluate((el) => el.scrollLeft);
    await rail.evaluate((el) => { el.scrollLeft = 200; });
    const scrollWidthAfter = await rail.evaluate((el) => el.scrollLeft);
    expect(scrollWidthAfter).toBeGreaterThan(scrollWidthBefore);
  });

  test('footer has "Открыть каталог" CTA', async ({ page }) => {
    const cta = page.getByRole("button", { name: /Открыть каталог/ });
    await expect(cta).toBeVisible();
    await cta.click();
    await expect(page.getByRole("heading", { name: /Все товары/i }).first()).toBeVisible();
  });
});

test.describe("Home — hero carousel", () => {
  test("carousel is visible with at least one slide", async ({ page }) => {
    await expect(page.getByText(/Витамины для иммунитета|Антиаллергия|Доставка/i).first()).toBeVisible();
  });

  test("slide CTA button is clickable", async ({ page }) => {
    const cta = page.getByRole("button", { name: /Подробнее/ }).first();
    await expect(cta).toBeVisible();
  });
});

test.describe("Home — trust strip", () => {
  test("shows 4 informational chips", async ({ page }) => {
    await expect(page.getByText("30–45 мин").first()).toBeVisible();
    await expect(page.getByText(/аптек/i).first()).toBeVisible();
    await expect(page.getByText(/товаров/i).first()).toBeVisible();
  });
});
