"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { create } from "zustand";

type NavHistoryState = {
  history: string[];
  push: (url: string) => void;
  /** Update the last entry (for search param changes without navigation). */
  replaceLast: (url: string) => void;
  pop: () => string;
};

const useNavHistoryStore = create<NavHistoryState>((set, get) => ({
  history: [],
  push: (url: string) => {
    const { history } = get();
    if (history[history.length - 1] === url) return;
    set({ history: [...history.slice(-19), url] });
  },
  replaceLast: (url: string) => {
    const { history } = get();
    if (history.length === 0) {
      set({ history: [url] });
    } else {
      set({ history: [...history.slice(0, -1), url] });
    }
  },
  pop: () => {
    const { history } = get();
    if (history.length < 2) return "/";
    const newHistory = history.slice(0, -1);
    set({ history: newHistory });
    return newHistory[newHistory.length - 1] ?? "/";
  },
}));

/** Call in every page to record navigation (captures full URL with search params). */
export function useRecordNavigation() {
  const pathname = usePathname();
  const push = useNavHistoryStore((s) => s.push);

  useEffect(() => {
    if (typeof window === "undefined") return;
    push(pathname + window.location.search);
  }, [pathname, push]);
}

/** Update last history entry without adding new one (for in-page search param changes). */
export function replaceLastNavigation(url: string) {
  useNavHistoryStore.getState().replaceLast(url);
}

/** Returns pop function that removes current from history and returns previous path. */
export function useGoBack() {
  return useNavHistoryStore((s) => s.pop);
}
