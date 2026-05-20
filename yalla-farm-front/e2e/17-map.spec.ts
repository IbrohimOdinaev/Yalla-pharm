import { expect, test, type ConsoleMessage, type Page } from "@playwright/test";
import { resetSession } from "./fixtures/auth";

const criticalMapErrorReasons = [
  "missing-api-key",
  "script-load-failed",
  "ymaps-global-missing",
  "server-side-load",
];

function collectYandexMapErrors(page: Page) {
  const messages: string[] = [];

  page.on("console", (message: ConsoleMessage) => {
    if (message.type() === "error" && message.text().includes("[map:yandex]")) {
      messages.push(message.text());
    }
  });

  return messages;
}

async function hasRuntimeYandexKey(page: Page) {
  return page.evaluate(() => {
    const win = window as unknown as {
      __YALLA_PHARM_RUNTIME_CONFIG__?: Record<string, string>;
    };

    return Boolean(win.__YALLA_PHARM_RUNTIME_CONFIG__?.NEXT_PUBLIC_YANDEX_MAPS_API_KEY);
  });
}

async function hasYmapsGlobal(page: Page) {
  return page.evaluate(() => Boolean((window as unknown as { ymaps?: unknown }).ymaps));
}

async function expectYandexMapBoots(page: Page) {
  const mapErrors = collectYandexMapErrors(page);

  await resetSession(page);
  await page.goto("/pharmacies/map");

  await expect(page.getByText("Не удалось загрузить карту")).toHaveCount(0, {
    timeout: 15_000,
  });
  await expect.poll(() => hasRuntimeYandexKey(page), { timeout: 10_000 }).toBe(true);
  await expect
    .poll(
      () =>
        page
          .locator('script[data-yandex-maps="v2"][src*="api-maps.yandex.ru/2.1/"]')
          .count(),
      { timeout: 15_000 },
    )
    .toBeGreaterThan(0);
  await expect.poll(() => hasYmapsGlobal(page), { timeout: 20_000 }).toBe(true);

  const criticalErrors = mapErrors.filter((message) =>
    criticalMapErrorReasons.some((reason) => message.includes(reason)),
  );
  expect(criticalErrors).toEqual([]);
}

test.describe("Pharmacies map", () => {
  for (let attempt = 1; attempt <= 6; attempt += 1) {
    test(`Yandex map boots on fresh load #${attempt}`, async ({ page }) => {
      await expectYandexMapBoots(page);
    });
  }
});
