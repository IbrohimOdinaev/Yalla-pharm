"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { create } from "zustand";

const STORAGE_KEY = "yalla.nav.history";
const MAX_ENTRIES = 25;

type NavHistoryState = {
  history: string[];
  push: (url: string) => void;
  /** Update the last entry (for search param changes without navigation). */
  replaceLast: (url: string) => void;
  pop: () => string;
};

function loadFromSession(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === "string") : [];
  } catch { return []; }
}

function saveToSession(history: string[]) {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(history));
  } catch { /* ignore quota / privacy errors */ }
}

const useNavHistoryStore = create<NavHistoryState>((set, get) => ({
  history: loadFromSession(),
  push: (url: string) => {
    const { history } = get();
    if (history[history.length - 1] === url) return;
    const next = [...history.slice(-(MAX_ENTRIES - 1)), url];
    set({ history: next });
    saveToSession(next);
  },
  replaceLast: (url: string) => {
    const { history } = get();
    const next = history.length === 0 ? [url] : [...history.slice(0, -1), url];
    set({ history: next });
    saveToSession(next);
  },
  pop: () => {
    const { history } = get();
    if (history.length < 2) {
      // Fallback to a sensible parent based on the current URL — never just "/"
      // when we can do better (e.g. /product/X → /, /workspace/order/X → /workspace).
      const current = history[0];
      const fallback = inferParentRoute(current);
      const next: string[] = fallback ? [fallback] : [];
      set({ history: next });
      saveToSession(next);
      return fallback ?? "/";
    }
    const next = history.slice(0, -1);
    set({ history: next });
    saveToSession(next);
    return next[next.length - 1] ?? "/";
  },
}));

/** Heuristic parent route when our nav stack is empty (deep link / refresh). */
function inferParentRoute(current: string | undefined): string | null {
  if (!current) return null;
  const path = current.split("?")[0];
  if (path.startsWith("/workspace/order/")) return "/workspace";
  if (path.startsWith("/superadmin")) return "/superadmin";
  if (path.startsWith("/workspace")) return "/workspace";
  if (path.startsWith("/product/")) return "/";
  if (path.startsWith("/checkout") || path.startsWith("/cart")) return "/cart";
  if (path.startsWith("/orders")) return "/";
  if (path.startsWith("/profile")) return "/";
  return null;
}

/** Call in every page to record navigation (captures full URL with search & hash). */
export function useRecordNavigation() {
  const pathname = usePathname();
  const push = useNavHistoryStore((s) => s.push);
  const replace = useNavHistoryStore((s) => s.replaceLast);

  useEffect(() => {
    if (typeof window === "undefined") return;
    push(pathname + window.location.search + window.location.hash);

    // Hash changes don't trigger a route change in Next.js, but they DO change
    // the user-visible state (e.g. tab in /superadmin#orders). Capture them so
    // back-navigation restores the right tab.
    function onHashChange() {
      replace(pathname + window.location.search + window.location.hash);
    }
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, [pathname, push, replace]);
}

/** Update last history entry without adding new one (for in-page search param changes). */
export function replaceLastNavigation(url: string) {
  useNavHistoryStore.getState().replaceLast(url);
}

/** Returns pop function that removes current from history and returns previous path. */
export function useGoBack() {
  return useNavHistoryStore((s) => s.pop);
}
