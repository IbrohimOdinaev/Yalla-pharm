"use client";

import { create } from "zustand";
import { addToBasket } from "@/entities/basket/api";

const STORAGE_KEY = "yalla.guest.basket.v1";

export type GuestItem = {
  medicineId: string;
  quantity: number;
};

type GuestCartState = {
  items: GuestItem[];
  load: () => void;
  addItem: (medicineId: string, quantity?: number) => void;
  removeItem: (medicineId: string) => void;
  setQuantity: (medicineId: string, quantity: number) => void;
  clear: () => void;
  mergeIntoServer: (token: string) => Promise<{ merged: number; failed: number }>;
};

function readStorage(): GuestItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed?.items) ? parsed.items : [];
  } catch {
    return [];
  }
}

function writeStorage(items: GuestItem[]) {
  if (typeof window === "undefined") return;
  if (items.length === 0) {
    window.localStorage.removeItem(STORAGE_KEY);
    return;
  }
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ items, updatedAt: new Date().toISOString() }));
}

export const useGuestCartStore = create<GuestCartState>((set, get) => ({
  items: [],

  load: () => {
    set({ items: readStorage() });
  },

  addItem: (medicineId, quantity = 1) => {
    const current = get().items;
    const existing = current.find((i) => i.medicineId === medicineId);
    const next = existing
      ? current.map((i) => (i.medicineId === medicineId ? { ...i, quantity: i.quantity + quantity } : i))
      : [...current, { medicineId, quantity }];
    writeStorage(next);
    set({ items: next });
  },

  removeItem: (medicineId) => {
    const next = get().items.filter((i) => i.medicineId !== medicineId);
    writeStorage(next);
    set({ items: next });
  },

  setQuantity: (medicineId, quantity) => {
    if (quantity <= 0) {
      get().removeItem(medicineId);
      return;
    }
    const next = get().items.map((i) => (i.medicineId === medicineId ? { ...i, quantity } : i));
    writeStorage(next);
    set({ items: next });
  },

  clear: () => {
    writeStorage([]);
    set({ items: [] });
  },

  mergeIntoServer: async (token) => {
    const items = get().items;
    let merged = 0;
    let failed = 0;

    for (const item of items) {
      try {
        await addToBasket(token, item.medicineId, item.quantity);
        merged++;
      } catch {
        failed++;
      }
    }

    if (merged > 0) {
      const remaining = items.filter((_, idx) => idx >= merged);
      writeStorage(remaining);
      set({ items: remaining });
    }

    return { merged, failed };
  }
}));
