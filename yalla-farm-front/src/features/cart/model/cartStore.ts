"use client";

import { create } from "zustand";
import type { ApiBasket, ApiBasketPosition } from "@/shared/types/api";
import { addToBasket, clearBasket, getBasket, removeFromBasket, updateBasketQuantity } from "@/entities/basket/api";

type CartState = {
  basket: ApiBasket;
  isLoading: boolean;
  error: string | null;
  loadBasket: (token: string) => Promise<void>;
  addItem: (token: string, medicineId: string) => Promise<void>;
  removeItem: (token: string, positionId: string) => Promise<void>;
  setQuantity: (token: string, positionId: string, quantity: number) => Promise<void>;
  reset: () => void;
};

const EMPTY_BASKET: ApiBasket = { positions: [] };

function normalizeBasket(basket?: ApiBasket): ApiBasket {
  return {
    positions: Array.isArray(basket?.positions) ? basket?.positions : [],
    pharmacyOptions: Array.isArray(basket?.pharmacyOptions) ? basket.pharmacyOptions : []
  };
}

function mergeExistingPosition(positions: ApiBasketPosition[], medicineId: string): ApiBasketPosition[] {
  const existing = positions.find((item) => String(item.medicineId) === String(medicineId));
  if (!existing) return positions;

  return positions.map((item) => {
    if (item.id !== existing.id) return item;
    return { ...item, quantity: Math.max(1, Number(item.quantity || 0) + 1) };
  });
}

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

  addItem: async (token, medicineId) => {
    set({ isLoading: true, error: null });

    try {
      const current = get().basket;
      const positions = Array.isArray(current.positions) ? current.positions : [];
      const existing = positions.find((item) => String(item.medicineId) === String(medicineId));

      const basket = existing
        ? await updateBasketQuantity(token, existing.id, Math.max(1, Number(existing.quantity || 0) + 1))
        : await addToBasket(token, medicineId, 1);

      set({ basket: normalizeBasket(basket), isLoading: false });
    } catch {
      set((state) => ({
        basket: { ...state.basket, positions: mergeExistingPosition(state.basket.positions ?? [], medicineId) },
        error: "Сервер не ответил. Количество увеличено локально, обновите страницу для синхронизации.",
        isLoading: false
      }));
    }
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
