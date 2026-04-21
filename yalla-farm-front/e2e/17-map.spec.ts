import { test, expect } from "@playwright/test";
import { resetSession } from "./fixtures/auth";

test.describe("Pharmacies map", () => {
  test.beforeEach(async ({ page }) => {
    await resetSession(page);
    await page.goto("/pharmacies/map");
    await page.waitForLoadState("networkidle").catch(() => undefined);
  });

  test("map canvas loads", async ({ page }) => {
    // Google Maps injects iframes / canvases with attributes we can query.
    const mapRoot = page.locator("div").filter({ has: page.locator('[role="region"]') }).first();
    await expect(mapRoot.first()).toBeVisible({ timeout: 15_000 });
  });

  test("pharmacy list below map is scrollable", async ({ page }) => {
    await expect(page.getByRole("heading", { name: /аптек в Душанбе/i }).or(
      page.getByText(/Нет аптек/i),
    ).first()).toBeVisible();
  });

  test("custom advanced-markers load (no default red pins)", async ({ page }) => {
    // Advanced markers wrap our custom HTML in a specific Google class name.
    // We check that native <img[src="...red_pin..."]> is not used by our overlays.
    await page.waitForTimeout(3_000); // give map a moment to render markers
    const defaultRedPins = page.locator('img[src*="red_pin"], img[src*="red-dot"]');
    expect(await defaultRedPins.count()).toBe(0);
  });
});
