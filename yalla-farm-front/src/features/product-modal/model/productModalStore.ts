"use client";

import { create } from "zustand";

/**
 * Tiny store driving the global product detail modal. We keep an opaque
 * "id-or-slug" string so callers don't have to know which form they hold;
 * `getMedicineByIdOrSlug` resolves both shapes downstream.
 *
 * One global modal is mounted by `AppShell`; opening here makes it appear,
 * closing here clears it. No URL change involved — the standalone
 * `/product/[id]` page still serves direct visits / SEO links.
 */
type ProductModalState = {
  productIdOrSlug: string | null;
  open: (idOrSlug: string) => void;
  close: () => void;
};

export const useProductModalStore = create<ProductModalState>((set) => ({
  productIdOrSlug: null,
  open: (idOrSlug) => set({ productIdOrSlug: idOrSlug }),
  close: () => set({ productIdOrSlug: null }),
}));
