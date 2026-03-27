"use client";

import { create } from "zustand";
import type { ApiBasket, ApiBasketPosition } from "@/shared/types/api";
import { addToBasket, clearBasket, getBasket, removeFromBasket, updateBasketQuantity } from "@/entities/basket/api";

type CartState = {
  basket: ApiBasket;
  isLoading: boolean;
  error: string | null;
  loadBasket: (token: string) => Promise<void>;
  addItem: (token: string, medicineId: string, quantity?: number) => Promise<void>;
  removeItem: (token: string, positionId: string) => Promise<void>;
  setQuantity: (token: string, positionId: string, quantity: number) => Promise<void>;
  reset: () => void;
};

const EMPTY_BASKET: ApiBasket = { positions: [] };

function normalizeBasket(basket?: ApiBasket): ApiBasket {
  const raw = Array.isArray(basket?.positions) ? basket?.positions : [];
  // Deduplicate positions by medicineId — keep the one with highest quantity
  const byMedicine = new Map<string, ApiBasketPosition>();
  for (const pos of raw) {
    const key = pos.medicineId;
    const existing = byMedicine.get(key);
    if (!existing || pos.quantity > existing.quantity) {
      byMedicine.set(key, pos);
    }
  }
  return {
    positions: Array.from(byMedicine.values()),
    pharmacyOptions: Array.isArray(basket?.pharmacyOptions) ? basket.pharmacyOptions : []
  };
}

// Mutex to prevent concurrent addItem calls from creating duplicates
let addItemQueue: Promise<void> = Promise.resolve();

export const useCartStore = create<CartState>((set, get) => ({
  basket: EMPTY_BASKET,
  isLoading: false,
  error: null,

  loadBasket: async (token) => {
    set({ isLoading: true, error: null });
    try {
      const basket = await getBasket(token);
      set({ basket: normalizeBasket(basket), isLoading: false });
    } catch (error) {
      set({ error: error instanceof Error ? error.message : "Не удалось загрузить корзину.", isLoading: false });
    }
  },

  addItem: async (token, medicineId, quantity = 1) => {
    // Chain calls sequentially to prevent duplicate positions
    const work = addItemQueue.then(async () => {
      set({ isLoading: true, error: null });
      try {
        // Re-read state after awaiting queue — previous call may have added this item
        const current = get().basket;
        const positions = Array.isArray(current.positions) ? current.positions : [];
        const existing = positions.find((item) => String(item.medicineId) === String(medicineId));

        const basket = existing
          ? await updateBasketQuantity(token, existing.id, Math.max(1, Number(existing.quantity || 0) + quantity))
          : await addToBasket(token, medicineId, quantity);

        set({ basket: normalizeBasket(basket), isLoading: false });
      } catch {
        set({ error: "Не удалось добавить товар. Попробуйте снова.", isLoading: false });
      }
    });
    addItemQueue = work.catch(() => undefined);
    await work;
  },

  removeItem: async (token, positionId) => {
    set({ isLoading: true, error: null });
    try {
      const basket = await removeFromBasket(token, positionId);
      set({ basket: normalizeBasket(basket), isLoading: false });
    } catch (error) {
      set({ error: error instanceof Error ? error.message : "Не удалось удалить товар.", isLoading: false });
    }
  },

  setQuantity: async (token, positionId, quantity) => {
    set({ isLoading: true, error: null });
    try {
      const basket = await updateBasketQuantity(token, positionId, Math.max(1, quantity));
      set({ basket: normalizeBasket(basket), isLoading: false });
    } catch (error) {
      set({ error: error instanceof Error ? error.message : "Не удалось обновить количество.", isLoading: false });
    }
  },

  reset: () => {
    set({ basket: EMPTY_BASKET, isLoading: false, error: null });
  }
}));

export async function clearCartAndSync(token: string): Promise<void> {
  await clearBasket(token);
}
