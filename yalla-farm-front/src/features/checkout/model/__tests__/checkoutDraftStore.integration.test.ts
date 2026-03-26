import { describe, expect, it, beforeEach } from "vitest";
import { useCheckoutDraftStore } from "@/features/checkout/model/checkoutDraftStore";

describe("checkoutDraftStore", () => {
  beforeEach(() => {
    useCheckoutDraftStore.getState().reset();
  });

  it("starts with empty values", () => {
    const state = useCheckoutDraftStore.getState();
    expect(state.pharmacyId).toBe("");
    expect(state.deliveryAddress).toBe("");
    expect(state.isPickup).toBe(false);
  });

  it("setDraft updates pharmacyId", () => {
    useCheckoutDraftStore.getState().setDraft({ pharmacyId: "ph-1" });
    expect(useCheckoutDraftStore.getState().pharmacyId).toBe("ph-1");
  });

  it("setDraft updates deliveryAddress", () => {
    useCheckoutDraftStore.getState().setDraft({ deliveryAddress: "Rudaki 10" });
    expect(useCheckoutDraftStore.getState().deliveryAddress).toBe("Rudaki 10");
  });

  it("setDraft updates isPickup", () => {
    useCheckoutDraftStore.getState().setDraft({ isPickup: true });
    expect(useCheckoutDraftStore.getState().isPickup).toBe(true);
  });

  it("reset clears all", () => {
    useCheckoutDraftStore.getState().setDraft({ pharmacyId: "x", deliveryAddress: "y", isPickup: true });
    useCheckoutDraftStore.getState().reset();
    const state = useCheckoutDraftStore.getState();
    expect(state.pharmacyId).toBe("");
    expect(state.deliveryAddress).toBe("");
    expect(state.isPickup).toBe(false);
  });
});
