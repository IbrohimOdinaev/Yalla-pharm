import { describe, expect, it } from "vitest";
import { useDeliveryAddressStore } from "@/features/delivery/model/deliveryAddressStore";

describe("deliveryAddressStore", () => {
  it("initial address is empty", () => {
    expect(useDeliveryAddressStore.getState().address).toBe("");
  });

  it("setAddress updates state and localStorage", () => {
    useDeliveryAddressStore.getState().setAddress("ул. Рудаки 100");
    expect(useDeliveryAddressStore.getState().address).toBe("ул. Рудаки 100");
    expect(localStorage.getItem("yalla.delivery.address")).toBe("ул. Рудаки 100");
  });

  it("load restores from localStorage", () => {
    localStorage.setItem("yalla.delivery.address", "ул. Исмоили Сомони 50");
    useDeliveryAddressStore.getState().load();
    expect(useDeliveryAddressStore.getState().address).toBe("ул. Исмоили Сомони 50");
  });

  it("setAddress empty clears localStorage", () => {
    useDeliveryAddressStore.getState().setAddress("test");
    useDeliveryAddressStore.getState().setAddress("");
    expect(localStorage.getItem("yalla.delivery.address")).toBeNull();
  });
});
