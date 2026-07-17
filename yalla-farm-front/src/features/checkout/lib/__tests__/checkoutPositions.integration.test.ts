import { describe, expect, it } from "vitest";
import {
  adjustExplicitPositionsFromPreview,
  buildCheckoutExplicitPositions,
  countSelectedAvailableMedicines,
} from "@/features/checkout/lib/checkoutPositions";
import type { ApiBasketPharmacyItem, ApiCheckoutPreviewResponse } from "@/shared/types/api";

describe("checkout position helpers", () => {
  it("excludes medicines missing from catalog from explicit checkout payload", () => {
    const validMedicineId = "valid-med";
    const missingMedicineId = "missing-med";
    const items: ApiBasketPharmacyItem[] = [
      {
        medicineId: missingMedicineId,
        requestedQuantity: 2,
        isFound: true,
        foundQuantity: 2,
        hasEnoughQuantity: true,
        price: 22,
      },
      {
        medicineId: validMedicineId,
        requestedQuantity: 3,
        isFound: true,
        foundQuantity: 1,
        hasEnoughQuantity: false,
        price: 10,
      },
    ];
    const selected = new Set([missingMedicineId, validMedicineId]);
    const missing = new Set([missingMedicineId]);

    expect(buildCheckoutExplicitPositions(items, selected, missing)).toEqual([
      { medicineId: validMedicineId, quantity: 1 },
    ]);
    expect(countSelectedAvailableMedicines(selected, missing)).toBe(1);
  });

  it("reduces selected quantity when checkout preview reports lower stock", () => {
    const positions = [
      { medicineId: "limited-med", quantity: 2 },
      { medicineId: "ok-med", quantity: 1 },
    ];
    const preview: ApiCheckoutPreviewResponse = {
      canCheckout: false,
      acceptedPositionsCount: 1,
      rejectedPositionsCount: 1,
      totalPositions: 2,
      positions: [
        {
          medicineId: "limited-med",
          quantity: 2,
          isRejected: true,
          foundQuantity: 1,
          reason: "InsufficientStock",
        },
        {
          medicineId: "ok-med",
          quantity: 1,
          isRejected: false,
          foundQuantity: 1,
          reason: "",
        },
      ],
    };

    expect(adjustExplicitPositionsFromPreview(positions, preview)).toEqual([
      { medicineId: "limited-med", quantity: 1 },
      { medicineId: "ok-med", quantity: 1 },
    ]);
  });

  it("drops unavailable medicines from explicit checkout payload", () => {
    const positions = [
      { medicineId: "missing-offer", quantity: 1 },
      { medicineId: "inactive-med", quantity: 1 },
      { medicineId: "zero-stock", quantity: 3 },
      { medicineId: "ok-med", quantity: 1 },
    ];
    const preview: ApiCheckoutPreviewResponse = {
      canCheckout: false,
      acceptedPositionsCount: 1,
      rejectedPositionsCount: 3,
      totalPositions: 4,
      positions: [
        {
          medicineId: "missing-offer",
          quantity: 1,
          isRejected: true,
          foundQuantity: 0,
          reason: "OfferNotFound",
        },
        {
          medicineId: "inactive-med",
          quantity: 1,
          isRejected: true,
          foundQuantity: 0,
          reason: "MedicineInactive",
        },
        {
          medicineId: "zero-stock",
          quantity: 3,
          isRejected: true,
          foundQuantity: 0,
          reason: "InsufficientStock",
        },
        {
          medicineId: "ok-med",
          quantity: 1,
          isRejected: false,
          foundQuantity: 1,
          reason: "",
        },
      ],
    };

    expect(adjustExplicitPositionsFromPreview(positions, preview)).toEqual([
      { medicineId: "ok-med", quantity: 1 },
    ]);
  });

  it("does not adjust when checkout preview has no recoverable changes", () => {
    const positions = [{ medicineId: "ok-med", quantity: 1 }];
    const preview: ApiCheckoutPreviewResponse = {
      canCheckout: false,
      acceptedPositionsCount: 0,
      rejectedPositionsCount: 1,
      totalPositions: 1,
      positions: [
        {
          medicineId: "ok-med",
          quantity: 1,
          isRejected: true,
          foundQuantity: 1,
          reason: "Unknown",
        },
      ],
    };

    expect(adjustExplicitPositionsFromPreview(positions, preview)).toBeNull();
  });
});
