"use client";

import { create } from "zustand";

type CheckoutDraftState = {
  pharmacyId: string;
  deliveryAddress: string;
  isPickup: boolean;
  setDraft: (payload: Partial<Pick<CheckoutDraftState, "pharmacyId" | "deliveryAddress" | "isPickup">>) => void;
  reset: () => void;
};

const initialState = {
  pharmacyId: "",
  deliveryAddress: "",
  isPickup: false
};

export const useCheckoutDraftStore = create<CheckoutDraftState>((set) => ({
  ...initialState,
  setDraft: (payload) => {
    set((state) => ({
      ...state,
      ...payload
    }));
  },
  reset: () => set(initialState)
}));
