import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright configuration for Yalla Farm E2E tests.
 *
 * These tests are designed to run against a live dev stack:
 *   docker compose --env-file .env.dev up -d --build
 *   npm run test:e2e
 *
 * Set `E2E_BASE_URL` if you want to target ngrok / staging / prod smoke:
 *   E2E_BASE_URL=https://cramped-sharron-subcuticular.ngrok-free.dev npm run test:e2e
 */
const BASE_URL = process.env.E2E_BASE_URL ?? "http://localhost:3000";

export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI ? [["github"], ["list"]] : [["list"], ["html", { open: "never" }]],

  use: {
    baseURL: BASE_URL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    locale: "ru-RU",
    timezoneId: "Asia/Dushanbe",
    // Accept ngrok's free-tier warning page automatically.
    extraHTTPHeaders: { "ngrok-skip-browser-warning": "true" },
  },

  projects: [
    {
      name: "desktop",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } },
    },
    {
      name: "mobile",
      use: { ...devices["Pixel 7"] },
    },
    {
      name: "tablet",
      use: { ...devices["iPad (gen 7)"] },
    },
  ],

  // Uncomment to auto-start the dev server when running tests locally without
  // Docker. Leave disabled when you already have `docker compose up`.
  //
  // webServer: {
  //   command: "npm run dev",
  //   url: BASE_URL,
  //   reuseExistingServer: !process.env.CI,
  //   timeout: 120_000,
  // },
});
