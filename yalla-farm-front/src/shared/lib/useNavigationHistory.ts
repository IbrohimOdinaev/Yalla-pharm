"use client";

import { useCallback } from "react";
import { usePathname, useRouter } from "next/navigation";

/**
 * Single source of truth for "go back": the **browser's** history.
 *
 * We used to maintain a parallel sessionStorage stack. That caused this class
 * of bug: browser-back would only pop browser history, our stack would stay
 * stale, and the next app-back would jump to the wrong place. Now the app's
 * back button is literally `router.back()`. Browser back and app back are the
 * same operation.
 *
 * For deep-link / refresh cases where `window.history.length === 1`, fall
 * back to a heuristic parent route instead of dead-ending on the same page.
 */
function inferParentRoute(pathname: string): string {
  if (pathname.startsWith("/workspace/order/")) return "/workspace";
  if (pathname.startsWith("/superadmin")) return "/superadmin";
  if (pathname.startsWith("/workspace")) return "/workspace";
  if (pathname.startsWith("/product/")) return "/";
  if (pathname.startsWith("/checkout")) return "/cart";
  if (pathname.startsWith("/cart/pharmacy")) return "/cart";
  if (pathname.startsWith("/cart")) return "/";
  if (pathname.startsWith("/payment-await")) return "/orders";
  if (pathname.startsWith("/orders")) return "/";
  if (pathname.startsWith("/profile")) return "/";
  if (pathname.startsWith("/pharmacies")) return "/";
  if (pathname.startsWith("/login/admin")) return "/";
  if (pathname.startsWith("/login")) return "/";
  if (pathname.startsWith("/register")) return "/";
  return "/";
}

/**
 * Returns a void callback that drives the TopBar's "back" button. No return
 * value — the caller used to have to decide between `router.back()` and
 * `router.push(goBack())`, which duplicated logic everywhere. This helper
 * does both.
 */
export function useGoBack(): () => void {
  const router = useRouter();
  const pathname = usePathname();

  return useCallback(() => {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
    } else {
      router.push(inferParentRoute(pathname));
    }
  }, [router, pathname]);
}

// Legacy no-op exports kept so existing imports keep compiling; they will be
// removed once we've purged the old references in follow-up commits.
export function useRecordNavigation(): void {
  /* native history is the source of truth now — nothing to record */
}
export function replaceLastNavigation(_url: string): void {
  /* noop: `window.history.replaceState` already does this directly */
}
