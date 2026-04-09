import { create } from "zustand";

type ProductModalState = {
  productId: string | null;
  open: (id: string) => void;
  close: () => void;
};

export const useProductModalStore = create<ProductModalState>((set) => ({
  productId: null,
  open: (id) => set({ productId: id }),
  close: () => set({ productId: null }),
}));
