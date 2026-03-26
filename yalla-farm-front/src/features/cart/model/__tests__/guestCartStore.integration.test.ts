import { describe, expect, it, beforeEach } from "vitest";
import { useGuestCartStore } from "@/features/cart/model/guestCartStore";

describe("guestCartStore", () => {
  beforeEach(() => {
    useGuestCartStore.getState().clear();
    window.localStorage.clear();
  });

  it("starts with empty items", () => {
    expect(useGuestCartStore.getState().items).toEqual([]);
  });

  it("addItem adds a new item", () => {
    useGuestCartStore.getState().addItem("med-1");
    expect(useGuestCartStore.getState().items).toEqual([{ medicineId: "med-1", quantity: 1 }]);
  });

  it("addItem increments quantity for existing item", () => {
    useGuestCartStore.getState().addItem("med-1");
    useGuestCartStore.getState().addItem("med-1");
    const items = useGuestCartStore.getState().items;
    expect(items.length).toBe(1);
    expect(items[0].quantity).toBe(2);
  });

  it("addItem with custom quantity", () => {
    useGuestCartStore.getState().addItem("med-1", 5);
    expect(useGuestCartStore.getState().items[0].quantity).toBe(5);
  });

  it("removeItem removes an item", () => {
    useGuestCartStore.getState().addItem("med-1");
    useGuestCartStore.getState().addItem("med-2");
    useGuestCartStore.getState().removeItem("med-1");
    expect(useGuestCartStore.getState().items).toEqual([{ medicineId: "med-2", quantity: 1 }]);
  });

  it("setQuantity updates quantity", () => {
    useGuestCartStore.getState().addItem("med-1");
    useGuestCartStore.getState().setQuantity("med-1", 10);
    expect(useGuestCartStore.getState().items[0].quantity).toBe(10);
  });

  it("clear empties all items", () => {
    useGuestCartStore.getState().addItem("med-1");
    useGuestCartStore.getState().addItem("med-2");
    useGuestCartStore.getState().clear();
    expect(useGuestCartStore.getState().items).toEqual([]);
  });

  it("load restores from localStorage", () => {
    // writeStorage wraps items in { items, updatedAt } object
    window.localStorage.setItem(
      "yalla.guest.basket.v1",
      JSON.stringify({ items: [{ medicineId: "med-1", quantity: 3 }], updatedAt: new Date().toISOString() })
    );
    useGuestCartStore.getState().load();
    expect(useGuestCartStore.getState().items).toEqual([{ medicineId: "med-1", quantity: 3 }]);
  });

  it("persists to localStorage on add", () => {
    useGuestCartStore.getState().addItem("med-1");
    const stored = JSON.parse(window.localStorage.getItem("yalla.guest.basket.v1") || "{}");
    expect(stored.items.length).toBe(1);
    expect(stored.items[0].medicineId).toBe("med-1");
  });
});
