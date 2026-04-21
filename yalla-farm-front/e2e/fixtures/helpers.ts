import type { Locator, Page } from "@playwright/test";
import { expect } from "@playwright/test";

/**
 * Dismiss the "Куда доставить заказ?" modal that auto-opens on first visit
 * when no address is stored. Many tests don't care about the address picker,
 * so they call this and move on.
 */
export async function dismissAddressModal(page: Page): Promise<void> {
  const closeBtn = page.getByRole("button", { name: "Закрыть" }).first();
  if (await closeBtn.isVisible().catch(() => false)) {
    await closeBtn.click();
  }
}

/** Open a selector with flexible matching — useful when a role isn't set. */
export function byText(page: Page, text: string): Locator {
  return page.locator(`text=${text}`).first();
}

/**
 * Clicks the first add-to-cart button found inside the home / search feed.
 * Works regardless of pharmacy-specific card variants since the button carries
 * the Russian label "В корзину".
 */
export async function addFirstProductToCart(page: Page): Promise<void> {
  const btn = page.getByRole("button", { name: /В корзину/i }).first();
  await expect(btn).toBeVisible();
  await btn.click();
}

/**
 * Reads the cart badge count shown on the TopBar bag icon. Returns 0 when
 * the badge is absent (empty cart).
 */
export async function readCartBadge(page: Page): Promise<number> {
  const badge = page.locator('[aria-label="Корзина"] span').filter({ hasText: /^\d+$/ }).first();
  if (!(await badge.isVisible().catch(() => false))) return 0;
  const txt = (await badge.textContent())?.trim() ?? "0";
  return Number(txt) || 0;
}

/** Scroll a horizontal rail by the given pixels. */
export async function scrollRailBy(rail: Locator, deltaX: number): Promise<void> {
  await rail.evaluate((el, dx) => {
    el.scrollLeft += dx as number;
  }, deltaX);
}
