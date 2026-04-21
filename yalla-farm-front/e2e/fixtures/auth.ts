import type { Page } from "@playwright/test";

/**
 * Auth fixtures. Since client login requires a real SMS round-trip and admin
 * login requires a real password, we fake the post-login state by injecting
 * a JWT-shaped token into localStorage — matches what StoreProvider does on
 * real login. Set `YALLA_E2E_{CLIENT,ADMIN,SUPERADMIN}_TOKEN` in the env to
 * run auth-gated tests against a real backend.
 *
 * A token is considered valid if it:
 *   1. is a proper JWT (header.payload.signature, base64url)
 *   2. decodes a role claim matching the call site (`Client`/`Admin`/`SuperAdmin`)
 *
 * If you run the backend with a dev bypass, you can put that token in the
 * env var. If the env var is missing, tests that rely on auth will skip
 * themselves so the suite stays green.
 */

export type Role = "Client" | "Admin" | "SuperAdmin";

export const AUTH_TOKENS: Record<Role, string | undefined> = {
  Client: process.env.YALLA_E2E_CLIENT_TOKEN,
  Admin: process.env.YALLA_E2E_ADMIN_TOKEN,
  SuperAdmin: process.env.YALLA_E2E_SUPERADMIN_TOKEN,
};

/**
 * Seeds localStorage before the page loads so React's StoreProvider will pick
 * the token up on mount (no waiting for a login screen). Tokens are stored
 * under the same key that `auth-storage.ts` uses.
 */
export async function loginAs(page: Page, role: Role): Promise<boolean> {
  const token = AUTH_TOKENS[role];
  if (!token) return false;

  await page.addInitScript(([tkn]) => {
    try {
      window.localStorage.setItem("yalla.front.auth.token", tkn as string);
    } catch { /* storage may be unavailable before first navigation */ }
  }, [token]);

  return true;
}

/**
 * Helper for test.describe blocks that should skip themselves if no token
 * was provided in the env.
 */
export function requireAuth(role: Role, reason?: string): string | null {
  if (AUTH_TOKENS[role]) return null;
  return (
    reason ??
    `Set YALLA_E2E_${role.toUpperCase()}_TOKEN to enable this suite — the current run is a guest/unauthenticated build.`
  );
}

/**
 * Clear any persisted auth/cart state from a previous test. Call before
 * navigating in tests that expect a fresh guest session.
 */
export async function resetSession(page: Page): Promise<void> {
  await page.addInitScript(() => {
    try {
      window.localStorage.clear();
      window.sessionStorage.clear();
    } catch { /* empty */ }
  });
}
