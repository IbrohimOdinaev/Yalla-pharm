import { create } from "zustand";

const STORAGE_KEY = "yalla.pharmacist.prescriptionDrafts";

export type DraftItem = {
  /** Stable client-side id for React keys / removal. */
  draftId: string;
  /** Either MedicineId (catalog ref) or ManualMedicineName (out-of-catalog) is set. */
  medicineId?: string | null;
  manualMedicineName?: string | null;
  quantity: number;
  pharmacistComment?: string | null;
  /** Display title cached at add-time so we don't re-fetch the catalog. */
  displayTitle: string;
  /** Cached price snapshot to show in the cart UI. Optional. */
  minPrice?: number | null;
};

export type DraftState = {
  overallComment: string;
  items: DraftItem[];
};

type DraftStore = {
  drafts: Record<string, DraftState>;
  load: () => void;
  getDraft: (prescriptionId: string) => DraftState;
  addItem: (prescriptionId: string, item: DraftItem) => void;
  updateItem: (prescriptionId: string, draftId: string, patch: Partial<DraftItem>) => void;
  removeItem: (prescriptionId: string, draftId: string) => void;
  setOverallComment: (prescriptionId: string, comment: string) => void;
  setDraft: (prescriptionId: string, draft: DraftState) => void;
  clearDraft: (prescriptionId: string) => void;
};

const EMPTY: DraftState = { overallComment: "", items: [] };

function persist(drafts: Record<string, DraftState>) {
  if (typeof window === "undefined") return;
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(drafts)); } catch { /* ignore */ }
}

/**
 * Per-prescription draft state for the pharmacist's "active cart". Survives
 * page reloads and tab switches via localStorage so the pharmacist can
 * juggle several active requests without losing in-progress checklists.
 */
export const usePrescriptionDraftStore = create<DraftStore>((set, get) => ({
  drafts: {},
  load: () => {
    if (typeof window === "undefined") return;
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw) as Record<string, DraftState>;
      if (parsed && typeof parsed === "object") set({ drafts: parsed });
    } catch { /* ignore */ }
  },
  getDraft: (prescriptionId) => get().drafts[prescriptionId] ?? EMPTY,
  addItem: (prescriptionId, item) => {
    const drafts = { ...get().drafts };
    const cur = drafts[prescriptionId] ?? EMPTY;
    drafts[prescriptionId] = { ...cur, items: [...cur.items, item] };
    set({ drafts });
    persist(drafts);
  },
  updateItem: (prescriptionId, draftId, patch) => {
    const drafts = { ...get().drafts };
    const cur = drafts[prescriptionId] ?? EMPTY;
    drafts[prescriptionId] = {
      ...cur,
      items: cur.items.map((i) => (i.draftId === draftId ? { ...i, ...patch } : i)),
    };
    set({ drafts });
    persist(drafts);
  },
  removeItem: (prescriptionId, draftId) => {
    const drafts = { ...get().drafts };
    const cur = drafts[prescriptionId] ?? EMPTY;
    drafts[prescriptionId] = { ...cur, items: cur.items.filter((i) => i.draftId !== draftId) };
    set({ drafts });
    persist(drafts);
  },
  setOverallComment: (prescriptionId, comment) => {
    const drafts = { ...get().drafts };
    const cur = drafts[prescriptionId] ?? EMPTY;
    drafts[prescriptionId] = { ...cur, overallComment: comment };
    set({ drafts });
    persist(drafts);
  },
  setDraft: (prescriptionId, draft) => {
    const drafts = { ...get().drafts, [prescriptionId]: draft };
    set({ drafts });
    persist(drafts);
  },
  clearDraft: (prescriptionId) => {
    const drafts = { ...get().drafts };
    delete drafts[prescriptionId];
    set({ drafts });
    persist(drafts);
  },
}));
