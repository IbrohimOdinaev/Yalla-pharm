# Yalla Farm — E2E Tests

End-to-end tests powered by [Playwright](https://playwright.dev/). They drive a real browser against a running dev stack and exercise every flow a user can hit.

## Quick start

```bash
# 1. Install Playwright + browsers (one-time)
npm install
npm run test:e2e:install     # downloads headless Chromium

# 2. Make sure the dev stack is up
docker compose --env-file .env.dev up -d --build
curl -sf http://localhost:3000 > /dev/null && echo OK

# 3. Run the suite
npm run test:e2e             # headless, all projects (desktop / mobile / tablet)
npm run test:e2e:headed      # watch the browser
npm run test:e2e:ui          # Playwright test explorer UI
```

Open the HTML report afterwards:

```bash
npx playwright show-report
```

## Target a different URL

```bash
# ngrok / staging / prod smoke
E2E_BASE_URL=https://cramped-sharron-subcuticular.ngrok-free.dev npm run test:e2e
```

## Auth-gated tests

Real login flows aren't scriptable without SMS / password access, so those tests **skip themselves** unless you pass a JWT via env:

| Role         | Env var                        |
|--------------|--------------------------------|
| Client       | `YALLA_E2E_CLIENT_TOKEN`       |
| Admin        | `YALLA_E2E_ADMIN_TOKEN`        |
| SuperAdmin   | `YALLA_E2E_SUPERADMIN_TOKEN`   |

How to get them quickly in dev:

```bash
# After logging in through the UI, grab the token from localStorage:
#   → DevTools → Application → Local Storage → yalla.front.auth.token
# Then:
YALLA_E2E_CLIENT_TOKEN="eyJhbGciOi..." npm run test:e2e
```

The `loginAs(page, role)` fixture in `fixtures/auth.ts` seeds the token into `localStorage` via `page.addInitScript` before navigation — same key (`yalla.front.auth.token`) that the real app uses, so `StoreProvider` picks it up on mount with no login UI interaction.

## File layout

```
e2e/
├── fixtures/
│   ├── auth.ts         # loginAs / requireAuth / resetSession
│   └── helpers.ts      # dismissAddressModal / readCartBadge / ...
├── 00-smoke.spec.ts           # Public routes respond 200 + render chrome
├── 01-home.spec.ts            # Header, category tiles, rails, hero carousel, trust strip
├── 02-search.spec.ts          # Search open/close, suggestions, URL sync, catalog view
├── 03-guest-cart.spec.ts      # Guest add/remove/qty, localStorage persistence
├── 04-product.spec.ts         # Modal, standalone page, sticky bottom CTA
├── 05-auth.spec.ts            # /login UI, validation, admin tabs, register
├── 06-cart-pharmacy.spec.ts   # Pharmacy picker, map, delivery/pickup tabs
├── 07-checkout.spec.ts        # Step progress, partial/OOS checkboxes (auth)
├── 08-orders.spec.ts          # List, expand, receipt code, actions (auth)
├── 09-profile.spec.ts         # Form, logout, delete-confirm, linking (auth)
├── 10-admin.spec.ts           # Workspace 3 tabs (auth)
├── 11-superadmin.spec.ts      # SA 5 tabs (auth)
├── 12-navigation.spec.ts      # Back-button sync, TopBar pills, sticky header
├── 13-responsive.spec.ts      # 90% width, viewport-specific features
├── 14-address-picker.spec.ts  # Modal UI, autocomplete, geolocate
├── 15-a11y.spec.ts            # Aria labels, alt text, keyboard nav
├── 16-edge-cases.spec.ts      # API-500, empty states, SignalR-guest bypass
└── 17-map.spec.ts             # Map load, custom AdvancedMarkers (no red pins)
```

## Project matrix

Every test runs three times — once per `projects` entry in `playwright.config.ts`:

| Project        | Device                        | Viewport              |
|----------------|-------------------------------|-----------------------|
| `desktop`      | Desktop Chrome                | 1440×900              |
| `mobile`       | Pixel 7 (Android Chrome)      | 412×915 with touch    |
| `tablet`       | iPad (gen 7)                  | 810×1080              |

Run a single project:

```bash
npm run test:e2e -- --project=desktop
npm run test:e2e -- --project=mobile
```

Run a single file:

```bash
npm run test:e2e -- e2e/03-guest-cart.spec.ts
```

Run a single test (by title substring):

```bash
npm run test:e2e -- -g "rapid + clicks increment"
```

## Writing new tests — ground rules

1. **Prefer `getByRole` / `getByLabel` / `getByText`** over CSS selectors — resilient to styling changes.
2. **Use `resetSession(page)`** in `beforeEach` when the test expects a fresh guest state.
3. **Handle empty data gracefully.** Catalog, pharmacy list, orders etc. may be empty in some envs — `test.skip(true, "no data")` is better than a flaky failure.
4. **Network-intercept for known-unstable flows.** See `16-edge-cases.spec.ts` for patterns using `page.route(...)`.
5. **Don't sleep blindly.** Prefer `expect.poll()` / `page.waitForLoadState()` / locator auto-waiting over `page.waitForTimeout()`.
6. **Test the contract, not the pixels.** Visual regression is a separate toolchain (Chromatic / Percy) — these tests focus on behaviour.

## CI

The suite is CI-ready:

```yaml
# .github/workflows/e2e.yml (example)
- uses: actions/setup-node@v4
  with: { node-version: 20 }
- run: npm ci
- run: npx playwright install --with-deps chromium
- run: docker compose --env-file .env.dev up -d --build
- run: npx wait-on http://localhost:3000
- run: npm run test:e2e
  env:
    YALLA_E2E_CLIENT_TOKEN: ${{ secrets.YALLA_E2E_CLIENT_TOKEN }}
    YALLA_E2E_ADMIN_TOKEN: ${{ secrets.YALLA_E2E_ADMIN_TOKEN }}
    YALLA_E2E_SUPERADMIN_TOKEN: ${{ secrets.YALLA_E2E_SUPERADMIN_TOKEN }}
- uses: actions/upload-artifact@v4
  if: always()
  with:
    name: playwright-report
    path: playwright-report/
```

## Known gaps

- **Payment provider flow** (iframe-based third-party): only the container page is tested; the payment form itself is out-of-scope.
- **Telegram OAuth deeplink**: we verify the button renders + opens the modal, but the actual bot handshake requires a live Telegram session.
- **Real-time updates (SignalR)**: tests assume guest mode has no hub connection; authed real-time paths are covered only lightly via polled UI.
- **Admin data tables** (workspace/superadmin): tested at the tab-switch level, not row-by-row CRUD. Extend once admin seed data is stable.
