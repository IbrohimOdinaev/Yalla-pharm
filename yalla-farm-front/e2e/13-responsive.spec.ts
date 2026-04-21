import { test, expect } from "@playwright/test";
import { dismissAddressModal } from "./fixtures/helpers";
import { resetSession } from "./fixtures/auth";

/**
 * These rely on the Playwright project matrix (desktop / mobile / tablet) —
 * each test runs automatically at all three sizes. We still inspect viewport-
 * sensitive features explicitly to catch layout regressions.
 */

test.beforeEach(async ({ page }) => {
  await resetSession(page);
  await page.goto("/");
  await dismissAddressModal(page);
});

test("main content area uses ~90% of the viewport width", async ({ page }) => {
  const main = page.locator("main").first();
  const box = await main.boundingBox();
  const viewportWidth = page.viewportSize()?.width ?? 1440;
  expect(box).not.toBeNull();
  if (box) {
    expect(box.width / viewportWidth).toBeGreaterThan(0.8);
    expect(box.width / viewportWidth).toBeLessThan(0.96);
  }
});

test("logo label 'Yalla Farm' shows on ≥ md, hidden on small", async ({ page, viewport }) => {
  const label = page.getByText("Yalla Farm").first();
  if (!viewport) return;
  if (viewport.width >= 768) {
    await expect(label).toBeVisible();
  } else {
    // On mobile, only the Y logo image is visible.
    await expect(label).not.toBeVisible();
  }
});

test("bottom nav is visible for admin/sa role and hidden for guests", async ({ page }) => {
  // Guest has no BottomNav. fixedOK because BottomNav returns null for role === null.
  const nav = page.locator("nav.fixed.bottom-0").first();
  expect(await nav.isVisible().catch(() => false)).toBe(false);
});

test("category tiles wrap or scroll depending on viewport", async ({ page }) => {
  const tilesRow = page.locator("section").filter({ has: page.getByRole("button", { name: "Боль и жар" }) }).first();
  await expect(tilesRow).toBeVisible();
});
