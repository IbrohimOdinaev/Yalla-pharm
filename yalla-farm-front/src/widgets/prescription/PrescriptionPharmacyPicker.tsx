"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAppSelector } from "@/shared/lib/redux";
import { Button, Icon } from "@/shared/ui";
import { formatMoney } from "@/shared/lib/format";
import { useCheckoutDraftStore } from "@/features/checkout/model/checkoutDraftStore";
import {
  getPrescriptionPharmacyOptions,
  type ApiPrescriptionPharmacyOption,
} from "@/entities/prescription/api";
import type { ApiBasketPharmacyItem } from "@/shared/types/api";

type Props = {
  prescriptionId: string;
};

/**
 * Pharmacy picker for a Decoded prescription. Loads
 * `/api/prescriptions/{id}/pharmacy-options`, lists each pharmacy with
 * the items it covers (catalog hits + manual-lookup shadow offers), and
 * on "Оформить" wires the checkout draft store with explicit positions
 * + the prescriptionId so the checkout page submits the right payload.
 */
export function PrescriptionPharmacyPicker({ prescriptionId }: Props) {
  const router = useRouter();
  const token = useAppSelector((s) => s.auth.token);

  const setDraft = useCheckoutDraftStore((s) => s.setDraft);

  const [options, setOptions] = useState<ApiPrescriptionPharmacyOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true); setError(null);
    try {
      const r = await getPrescriptionPharmacyOptions(token, prescriptionId);
      setOptions(r.pharmacyOptions);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось загрузить аптеки.");
    } finally {
      setLoading(false);
    }
  }, [token, prescriptionId]);

  useEffect(() => { load(); }, [load]);

  function pickPharmacy(opt: ApiPrescriptionPharmacyOption) {
    // Translate prescription line items into the cart-pharmacy item shape
    // the checkout page already understands. Items without a resolved
    // medicineId at this pharmacy (manual lookup miss) become "not found"
    // entries — checkout filters them via the same selection toggle the
    // basket flow uses.
    const items: ApiBasketPharmacyItem[] = opt.items.map((it) => ({
      medicineId: it.medicineId ?? "",
      requestedQuantity: it.requestedQuantity,
      isFound: it.isFound,
      foundQuantity: it.foundQuantity,
      hasEnoughQuantity: it.hasEnoughQuantity,
      price: it.price ?? null,
      useUnitMode: it.useUnitMode ?? false,
      unitCount: it.unitCount ?? null,
      unitTotalPrice: it.unitTotalPrice ?? null,
    })).filter((i) => i.medicineId);

    if (items.length === 0) return;

    setDraft({
      pharmacyId: opt.pharmacyId,
      selectedPharmacyTitle: opt.pharmacyTitle,
      selectedPharmacyItems: items,
      selectedPharmacyTotalCost: opt.totalCost,
      ignoredPositionIds: [],
      isPickup: false,
      prescriptionId,
    });
    router.push("/checkout");
  }

  if (error) {
    return (
      <div className="rounded-2xl bg-secondary/10 p-3 text-sm font-semibold text-secondary">{error}</div>
    );
  }

  if (loading) {
    return (
      <div className="rounded-2xl bg-surface-container-low p-4 text-sm text-on-surface-variant">
        Подбираем аптеки…
      </div>
    );
  }

  if (options.length === 0) {
    return (
      <div className="rounded-2xl bg-surface-container-low p-4 text-sm text-on-surface-variant">
        Пока ни одна аптека не покрывает позиции рецепта.
      </div>
    );
  }

  return (
    <ul className="space-y-2">
      {options.map((opt) => {
        const ratio = `${opt.foundItemsCount}/${opt.totalItemsCount}`;
        const inactive = !opt.pharmacyIsActive;
        const partial = opt.foundItemsCount < opt.totalItemsCount;
        return (
          <li
            key={opt.pharmacyId}
            className={`rounded-2xl bg-surface-container-lowest p-3 shadow-card xs:p-4 ${
              inactive ? "opacity-60" : ""
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="font-bold">{opt.pharmacyTitle}</p>
                <p className="text-xs text-on-surface-variant">
                  Покрывает: <span className="font-bold text-on-surface">{ratio}</span>
                  {opt.foundItemsCount > 0 ? (
                    <span className="ml-2">
                      от <span className="font-bold text-primary">{formatMoney(opt.totalCost)}</span>
                    </span>
                  ) : null}
                  {!opt.isAvailable && opt.foundItemsCount === opt.totalItemsCount ? (
                    <span className="ml-2 text-secondary">временно недоступна</span>
                  ) : partial ? (
                    <span className="ml-2 text-warning">часть позиций отсутствует</span>
                  ) : null}
                </p>
              </div>
              <Button
                size="sm"
                onClick={() => pickPharmacy(opt)}
                disabled={!opt.pharmacyIsActive || opt.foundItemsCount === 0}
              >
                Оформить
              </Button>
            </div>

            {/* Compact item list — show title, qty, price, and a badge
                for items that came from the manual-lookup workflow. */}
            <ul className="mt-2 space-y-1 text-[11px]">
              {opt.items.map((it) => {
                const inUnitMode = it.useUnitMode === true && (it.unitTotalPrice ?? null) != null;
                return (
                  <li key={it.checklistItemId} className="flex items-start gap-2">
                    <span className={`mt-0.5 inline-flex h-1.5 w-1.5 flex-shrink-0 rounded-full ${
                      it.isFound ? (it.hasEnoughQuantity ? "bg-primary" : "bg-warning") : "bg-secondary"
                    }`} />
                    <span className="min-w-0 flex-1">
                      <span className="line-clamp-1 font-bold text-on-surface">{it.title}</span>
                      {it.isManualLookup ? (
                        <span className="ml-1 rounded-full bg-tertiary/15 px-1.5 py-0 text-[9px] font-bold text-tertiary">
                          предложение аптеки
                        </span>
                      ) : null}
                      {inUnitMode ? (
                        <span className="ml-1 rounded-full bg-accent-sun/30 px-1.5 py-0 text-[9px] font-bold text-accent-sun-ink">
                          поштучно
                        </span>
                      ) : null}
                    </span>
                    <span className="flex-shrink-0 text-on-surface-variant">
                      {inUnitMode ? (
                        <>
                          {it.unitCount ?? 0} шт. · {formatMoney(it.unitTotalPrice ?? 0)}
                        </>
                      ) : (
                        <>
                          ×{it.requestedQuantity}
                          {it.price ? ` · ${formatMoney(it.price)}` : ""}
                        </>
                      )}
                      {!it.isFound ? " · нет" : !it.hasEnoughQuantity ? ` · ост: ${it.foundQuantity}` : ""}
                    </span>
                  </li>
                );
              })}
            </ul>
          </li>
        );
      })}
    </ul>
  );
}
