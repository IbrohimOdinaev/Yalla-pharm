import type { ApiBasketPharmacyItem } from "@/shared/types/api";

export type CheckoutExplicitPosition = {
  medicineId: string;
  quantity: number;
};

export function buildCheckoutExplicitPositions(
  checkoutItems: ApiBasketPharmacyItem[],
  selectedMedicineIds: ReadonlySet<string>,
  missingMedicineIds: ReadonlySet<string>,
): CheckoutExplicitPosition[] {
  return checkoutItems
    .filter((item) => selectedMedicineIds.has(item.medicineId) && !missingMedicineIds.has(item.medicineId))
    .map((item) => ({
      medicineId: item.medicineId,
      quantity: Math.min(item.foundQuantity, item.requestedQuantity),
    }))
    .filter((position) => position.quantity > 0);
}

export function countSelectedAvailableMedicines(
  selectedMedicineIds: ReadonlySet<string>,
  missingMedicineIds: ReadonlySet<string>,
): number {
  let count = 0;
  for (const id of selectedMedicineIds) {
    if (!missingMedicineIds.has(id)) count++;
  }
  return count;
}
