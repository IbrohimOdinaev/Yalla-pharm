"use client";

import { create } from "zustand";

const STORAGE_KEY = "yalla.delivery.address";
const COORDS_STORAGE_KEY = "yalla.delivery.coords";
const HISTORY_STORAGE_KEY = "yalla.delivery.history";

type Coords = { lat: number; lng: number };

export type SavedAddress = {
  address: string;
  coords: Coords | null;
  /** ISO timestamp when last used */
  usedAt: string;
};

type DeliveryAddressState = {
  address: string;
  coords: Coords | null;
  /** Saved address history for the current user */
  savedAddresses: SavedAddress[];
  setAddress: (address: string) => void;
  setCoords: (coords: Coords | null) => void;
  setAddressWithCoords: (address: string, coords: Coords | null) => void;
  load: () => void;
  /** Load saved address history for a specific user (call after login) */
  loadHistory: (userId: string) => void;
  /** Save current address to user's history */
  saveToHistory: (userId: string) => void;
  /** Remove an address from history */
  removeFromHistory: (userId: string, address: string) => void;
};

function getHistoryKey(userId: string) {
  return `${HISTORY_STORAGE_KEY}.${userId}`;
}

function readHistory(userId: string): SavedAddress[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(getHistoryKey(userId));
    if (!raw) return [];
    return JSON.parse(raw);
  } catch { return []; }
}

function writeHistory(userId: string, history: SavedAddress[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(getHistoryKey(userId), JSON.stringify(history));
}

const MAX_SAVED_ADDRESSES = 10;

export const useDeliveryAddressStore = create<DeliveryAddressState>((set, get) => ({
  address: "",
  coords: null,
  savedAddresses: [],
  setAddress: (address) => {
    set({ address });
    if (typeof window !== "undefined") {
      if (address) localStorage.setItem(STORAGE_KEY, address);
      else localStorage.removeItem(STORAGE_KEY);
    }
  },
  setCoords: (coords) => {
    set({ coords });
    if (typeof window !== "undefined") {
      if (coords) localStorage.setItem(COORDS_STORAGE_KEY, JSON.stringify(coords));
      else localStorage.removeItem(COORDS_STORAGE_KEY);
    }
  },
  setAddressWithCoords: (address, coords) => {
    set({ address, coords });
    if (typeof window !== "undefined") {
      if (address) localStorage.setItem(STORAGE_KEY, address);
      else localStorage.removeItem(STORAGE_KEY);
      if (coords) localStorage.setItem(COORDS_STORAGE_KEY, JSON.stringify(coords));
      else localStorage.removeItem(COORDS_STORAGE_KEY);
    }
  },
  load: () => {
    if (typeof window === "undefined") return;
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) set({ address: saved });
    const savedCoords = localStorage.getItem(COORDS_STORAGE_KEY);
    if (savedCoords) {
      try { set({ coords: JSON.parse(savedCoords) }); } catch { /* ignore */ }
    }
  },
  loadHistory: (userId) => {
    set({ savedAddresses: readHistory(userId) });
  },
  saveToHistory: (userId) => {
    const { address, coords } = get();
    if (!address.trim()) return;

    const history = readHistory(userId);
    // Remove duplicate (same address text)
    const filtered = history.filter((h) => h.address !== address);
    // Add to front
    const updated = [
      { address, coords, usedAt: new Date().toISOString() },
      ...filtered,
    ].slice(0, MAX_SAVED_ADDRESSES);

    writeHistory(userId, updated);
    set({ savedAddresses: updated });
  },
  removeFromHistory: (userId, addressToRemove) => {
    const history = readHistory(userId);
    const updated = history.filter((h) => h.address !== addressToRemove);
    writeHistory(userId, updated);
    set({ savedAddresses: updated });
  },
}));
