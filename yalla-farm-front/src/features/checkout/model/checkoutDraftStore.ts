"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { ApiBasketPharmacyItem } from "@/shared/types/api";

type DeliveryAddressData = {
  addressId?: number | null;
  title: string;
  address: string;
  lat: number;
  lng: number;
};

type CheckoutDraftState = {
  pharmacyId: string;
  selectedPharmacyTitle: string;
  selectedPharmacyItems: ApiBasketPharmacyItem[];
  selectedPharmacyTotalCost: number;
  ignoredPositionIds: string[];
  deliveryAddress: string;
  isPickup: boolean;
  deliveryAddressData: DeliveryAddressData | null;
  deliveryCost: number | null;
  deliveryDistance: number | null;
  setDraft: (payload: Partial<Pick<CheckoutDraftState, "pharmacyId" | "selectedPharmacyTitle" | "selectedPharmacyItems" | "selectedPharmacyTotalCost" | "ignoredPositionIds" | "deliveryAddress" | "isPickup">>) => void;
  setDeliveryAddressData: (data: DeliveryAddressData | null) => void;
  setDeliveryCost: (cost: number | null, distance: number | null) => void;
  reset: () => void;
};

const initialState = {
  pharmacyId: "",
  selectedPharmacyTitle: "",
  selectedPharmacyItems: [] as ApiBasketPharmacyItem[],
  selectedPharmacyTotalCost: 0,
  ignoredPositionIds: [] as string[],
  deliveryAddress: "",
  isPickup: false,
  deliveryAddressData: null as DeliveryAddressData | null,
  deliveryCost: null as number | null,
  deliveryDistance: null as number | null,
};

export const useCheckoutDraftStore = create<CheckoutDraftState>()(
  persist(
    (set) => ({
      ...initialState,
      setDraft: (payload) => {
        set((state) => ({ ...state, ...payload }));
      },
      setDeliveryAddressData: (data) => set({ deliveryAddressData: data }),
      setDeliveryCost: (cost, distance) => set({ deliveryCost: cost, deliveryDistance: distance }),
      reset: () => set(initialState),
    }),
    {
      name: "yalla.checkout.draft",
      storage: createJSONStorage(() => sessionStorage),
      partialize: (state) => ({
        pharmacyId: state.pharmacyId,
        selectedPharmacyTitle: state.selectedPharmacyTitle,
        selectedPharmacyItems: state.selectedPharmacyItems,
        selectedPharmacyTotalCost: state.selectedPharmacyTotalCost,
        ignoredPositionIds: state.ignoredPositionIds,
        isPickup: state.isPickup,
      }),
    }
  )
);
