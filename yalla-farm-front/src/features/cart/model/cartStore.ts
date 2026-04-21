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

// Latest-request tracking per positionId. When the user mashes +/− quickly, we
// fire one API call per click in the background; a stale response must not
// overwrite the optimistic state set by a newer click. Each call captures its
// sequence id; only the LATEST call is allowed to reconcile with the server.
const quantityRequestId = new Map<string, number>();

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
    // Optimistic removal — the row disappears from the UI instantly; no
    // isLoading flip so surrounding controls stay interactive.
    const prev = get().basket;
    set((state) => ({
      basket: {
        ...state.basket,
        positions: (state.basket.positions ?? []).filter((p) => p.id !== positionId),
      },
      error: null,
    }));
    try {
      const basket = await removeFromBasket(token, positionId);
      set({ basket: normalizeBasket(basket) });
    } catch (error) {
      // Rollback on failure.
      set({
        basket: prev,
        error: error instanceof Error ? error.message : "Не удалось удалить товар.",
      });
    }
  },

  setQuantity: async (token, positionId, quantity) => {
    const newQty = Math.max(1, quantity);

    // Optimistic update: reflect the new qty in state immediately so buttons
    // stay responsive under rapid clicking. No isLoading flip.
    set((state) => ({
      basket: {
        ...state.basket,
        positions: (state.basket.positions ?? []).map((p) =>
          p.id === positionId ? { ...p, quantity: newQty } : p,
        ),
      },
      error: null,
    }));

    // Latest-wins. A rapid sequence of clicks fires N API calls; only the
    // response to the most-recent one is allowed to overwrite the optimistic
    // state (otherwise stale responses would flicker the UI back).
    const reqId = (quantityRequestId.get(positionId) ?? 0) + 1;
    quantityRequestId.set(positionId, reqId);

    try {
      const basket = await updateBasketQuantity(token, positionId, newQty);
      if (quantityRequestId.get(positionId) === reqId) {
        set({ basket: normalizeBasket(basket) });
      }
    } catch (error) {
      if (quantityRequestId.get(positionId) === reqId) {
        set({ error: error instanceof Error ? error.message : "Не удалось обновить количество." });
        // Resync from server so the optimistic state doesn't go out of sync.
        try {
          const basket = await getBasket(token);
          set({ basket: normalizeBasket(basket) });
        } catch { /* best effort */ }
      }
    }
  },

  reset: () => {
    set({ basket: EMPTY_BASKET, isLoading: false, error: null });
  }
}));

export async function clearCartAndSync(token: string): Promise<void> {
  await clearBasket(token);
}
