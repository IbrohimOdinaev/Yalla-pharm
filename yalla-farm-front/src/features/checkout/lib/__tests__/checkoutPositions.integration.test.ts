import { describe, expect, it } from "vitest";
import { buildCheckoutExplicitPositions, countSelectedAvailableMedicines } from "@/features/checkout/lib/checkoutPositions";
import type { ApiBasketPharmacyItem } from "@/shared/types/api";

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
});
