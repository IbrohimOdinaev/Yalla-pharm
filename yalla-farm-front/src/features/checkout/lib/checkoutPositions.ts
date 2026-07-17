import type { ApiBasketPharmacyItem, ApiCheckoutPreviewResponse } from "@/shared/types/api";

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

export function buildPreviewErrorMessage(preview: ApiCheckoutPreviewResponse): string {
  const rejected = preview.positions?.find((position) => position.isRejected);
  if (!rejected) return "Состав заказа изменился. Обновите корзину и попробуйте снова.";

  if (rejected.reason === "InsufficientStock") {
    return "Количество одного из товаров изменилось. Обновите корзину и попробуйте снова.";
  }

  if (rejected.reason === "OfferNotFound") {
    return "Один из выбранных товаров больше недоступен в этой аптеке.";
  }

  if (rejected.reason === "MedicineInactive") {
    return "Один из выбранных товаров больше недоступен.";
  }

  return "Состав заказа изменился. Обновите корзину и попробуйте снова.";
}

export function adjustExplicitPositionsFromPreview(
  positions: CheckoutExplicitPosition[],
  preview: ApiCheckoutPreviewResponse,
): CheckoutExplicitPosition[] | null {
  const previewByMedicine = new Map(
    (preview.positions ?? []).map((position) => [position.medicineId, position]),
  );
  let changed = false;

  const adjusted = positions.flatMap((position) => {
    const previewPosition = previewByMedicine.get(position.medicineId);
    if (!previewPosition?.isRejected) return [position];

    if (previewPosition.reason === "InsufficientStock") {
      const nextQuantity = Math.min(position.quantity, Math.max(0, previewPosition.foundQuantity));
      changed = changed || nextQuantity !== position.quantity;
      return nextQuantity > 0 ? [{ ...position, quantity: nextQuantity }] : [];
    }

    if (previewPosition.reason === "OfferNotFound" || previewPosition.reason === "MedicineInactive") {
      changed = true;
      return [];
    }

    return [position];
  });

  return changed && adjusted.length > 0 ? adjusted : null;
}
