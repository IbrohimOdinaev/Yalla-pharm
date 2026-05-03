import { create } from "zustand";

const STORAGE_KEY = "yalla.pharmacist.activePrescriptionId";

type ActivePrescriptionStore = {
  activeId: string | null;
  isPickerOpen: boolean;
  setActiveId: (id: string | null) => void;
  openPicker: () => void;
  closePicker: () => void;
  load: () => void;
};

/**
 * Holds the prescription the pharmacist is currently composing for.
 * Persisted to localStorage so a refresh keeps the same active request.
 * The picker is opened from the header pill on every pharmacist page.
 */
export const useActivePrescriptionStore = create<ActivePrescriptionStore>((set) => ({
  activeId: null,
  isPickerOpen: false,
  setActiveId: (id) => {
    set({ activeId: id });
    if (typeof window === "undefined") return;
    if (id) localStorage.setItem(STORAGE_KEY, id);
    else localStorage.removeItem(STORAGE_KEY);
  },
  openPicker: () => set({ isPickerOpen: true }),
  closePicker: () => set({ isPickerOpen: false }),
  load: () => {
    if (typeof window === "undefined") return;
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) set({ activeId: raw });
  },
}));
