"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

/**
 * "We're picking an analog right now" mode for the pharmacist. Set when
 * the pharmacist clicks "Привязать аналог" on a draft item; consumed
 * (and cleared) when they click the "+" on any catalog card or pick a
 * medicine from the product modal. Persisted to sessionStorage so the
 * navigation hop (/pharmacist/cart → /pharmacist/catalog) doesn't drop
 * the target.
 */
export type AnalogTarget = {
  /** Prescription this draft item belongs to. */
  prescriptionId: string;
  /** PharmacistDraftStore item id we'll write the analog into. */
  draftId: string;
  /** Original medicine id (catalog ref) — empty string when the line is a
   *  manual entry that has no catalog match. We use it to filter the
   *  analog out of catalog suggestions (analog must differ from original). */
  sourceMedicineId: string;
  /** Display title for the banner shown on top of the catalog. */
  sourceTitle: string;
};

type AnalogTargetState = {
  target: AnalogTarget | null;
  setTarget: (target: AnalogTarget) => void;
  clear: () => void;
};

export const useAnalogTargetStore = create<AnalogTargetState>()(
  persist(
    (set) => ({
      target: null,
      setTarget: (target) => set({ target }),
      clear: () => set({ target: null }),
    }),
    {
      name: "yalla.pharmacist.analogTarget",
      storage: createJSONStorage(() => sessionStorage),
    },
  ),
);
