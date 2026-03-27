"use client";

import { create } from "zustand";

const STORAGE_KEY = "yalla.delivery.address";

type DeliveryAddressState = {
  address: string;
  setAddress: (address: string) => void;
  load: () => void;
};

export const useDeliveryAddressStore = create<DeliveryAddressState>((set) => ({
  address: "",
  setAddress: (address) => {
    set({ address });
    if (typeof window !== "undefined") {
      if (address) localStorage.setItem(STORAGE_KEY, address);
      else localStorage.removeItem(STORAGE_KEY);
    }
  },
  load: () => {
    if (typeof window === "undefined") return;
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) set({ address: saved });
  },
}));
