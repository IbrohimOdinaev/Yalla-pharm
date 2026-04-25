import type { ApiBasketPharmacyOption, ApiMedicine } from "@/shared/types/api";

export type BestPharmacyPrice = {
  price: number;
  enoughCount: number;
  totalCount: number;
  missingCount: number;
  pharmacyId?: string;
  pharmacyTitle?: string;
};

export function computeBestPriceFromPharmacyOptions(
  options: ApiBasketPharmacyOption[] | undefined,
  totalPositions: number,
): BestPharmacyPrice | null {
  if (!options || options.length === 0 || totalPositions === 0) return null;

  const active = options.filter((o) => o.pharmacyIsActive !== false);
  if (active.length === 0) return null;

  const maxEnough = active.reduce(
    (m, o) => Math.max(m, o.enoughQuantityMedicinesCount ?? 0),
    0,
  );
  if (maxEnough === 0) return null;

  const tier = active.filter(
    (o) => (o.enoughQuantityMedicinesCount ?? 0) === maxEnough,
  );

  const best = tier.reduce((a, b) =>
    (a.totalCost ?? Number.POSITIVE_INFINITY) <=
    (b.totalCost ?? Number.POSITIVE_INFINITY)
      ? a
      : b,
  );

  return {
    price: best.totalCost ?? 0,
    enoughCount: maxEnough,
    totalCount: totalPositions,
    missingCount: Math.max(0, totalPositions - maxEnough),
    pharmacyId: best.pharmacyId,
    pharmacyTitle: best.pharmacyTitle,
  };
}

export function computeBestPriceFromOffers(
  cartItems: ReadonlyArray<{ medicineId: string; quantity: number }>,
  medicineMap: Record<string, ApiMedicine>,
): BestPharmacyPrice | null {
  if (cartItems.length === 0) return null;

  const pharmacyIds = new Set<string>();
  for (const item of cartItems) {
    const offers = medicineMap[item.medicineId]?.offers ?? [];
    for (const offer of offers) pharmacyIds.add(offer.pharmacyId);
  }
  if (pharmacyIds.size === 0) return null;

  type Tally = {
    pharmacyId: string;
    pharmacyTitle?: string;
    enoughCount: number;
    totalCost: number;
  };

  const tallies: Tally[] = [];
  for (const pharmacyId of pharmacyIds) {
    let enoughCount = 0;
    let totalCost = 0;
    let pharmacyTitle: string | undefined;

    for (const item of cartItems) {
      const offers = medicineMap[item.medicineId]?.offers ?? [];
      const offer = offers.find((o) => o.pharmacyId === pharmacyId);
      if (!offer) continue;
      pharmacyTitle = pharmacyTitle ?? offer.pharmacyTitle;
      if (offer.stockQuantity >= item.quantity) enoughCount++;
      totalCost += offer.price * item.quantity;
    }

    if (enoughCount > 0) {
      tallies.push({ pharmacyId, pharmacyTitle, enoughCount, totalCost });
    }
  }

  if (tallies.length === 0) return null;

  const maxEnough = tallies.reduce((m, t) => Math.max(m, t.enoughCount), 0);
  const tier = tallies.filter((t) => t.enoughCount === maxEnough);
  const best = tier.reduce((a, b) => (a.totalCost <= b.totalCost ? a : b));

  return {
    price: best.totalCost,
    enoughCount: maxEnough,
    totalCount: cartItems.length,
    missingCount: Math.max(0, cartItems.length - maxEnough),
    pharmacyId: best.pharmacyId,
    pharmacyTitle: best.pharmacyTitle,
  };
}
