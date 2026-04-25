import { create } from "zustand";

const STORAGE_KEY = "yalla.selectedPharmacy";

type SelectedPharmacy = {
  id: string;
  title: string;
  iconUrl?: string | null;
};

type PharmacyStoreState = {
  selectedPharmacy: SelectedPharmacy | null;
  isPickerOpen: boolean;
  setPharmacy: (pharmacy: SelectedPharmacy | null) => void;
  openPicker: () => void;
  closePicker: () => void;
  load: () => void;
  clear: () => void;
};

export const usePharmacyStore = create<PharmacyStoreState>((set) => ({
  selectedPharmacy: null,
  isPickerOpen: false,
  setPharmacy: (pharmacy) => {
    set({ selectedPharmacy: pharmacy });
    if (typeof window !== "undefined") {
      if (pharmacy) localStorage.setItem(STORAGE_KEY, JSON.stringify(pharmacy));
      else localStorage.removeItem(STORAGE_KEY);
    }
  },
  openPicker: () => set({ isPickerOpen: true }),
  closePicker: () => set({ isPickerOpen: false }),
  load: () => {
    if (typeof window === "undefined") return;
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      try { set({ selectedPharmacy: JSON.parse(raw) }); } catch { /* ignore */ }
    }
  },
  clear: () => {
    set({ selectedPharmacy: null });
    if (typeof window !== "undefined") localStorage.removeItem(STORAGE_KEY);
  },
}));
