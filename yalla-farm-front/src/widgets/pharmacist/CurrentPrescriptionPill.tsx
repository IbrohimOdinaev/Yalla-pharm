"use client";

import { useEffect, useState } from "react";
import { useAppSelector } from "@/shared/lib/redux";
import { useActivePrescriptionStore } from "@/features/pharmacist/model/activePrescriptionStore";
import { getPharmacistAll } from "@/entities/pharmacist/api";
import type { ApiPrescription } from "@/entities/prescription/api";
import { AuthedImage, Icon } from "@/shared/ui";

/**
 * Always-visible header pill on every pharmacist page. Shows the
 * currently-active prescription (client name/phone + first photo) and
 * opens the picker on click. Clicking when nothing is selected reads
 * "Выбрать рецепт".
 */
export function CurrentPrescriptionPill() {
  const token = useAppSelector((s) => s.auth.token);
  const activeId = useActivePrescriptionStore((s) => s.activeId);
  const openPicker = useActivePrescriptionStore((s) => s.openPicker);
  const [active, setActive] = useState<ApiPrescription | null>(null);

  // Resolve the active id → prescription details so the pill can show the
  // client name/phone. We re-fetch on activeId change; the API call is
  // cheap (single GET) and avoids stale data when the user takes a
  // different prescription into review.
  useEffect(() => {
    if (!token || !activeId) { setActive(null); return; }
    let cancelled = false;
    getPharmacistAll(token)
      .then((all) => {
        if (cancelled) return;
        setActive(all.find((p) => p.prescriptionId === activeId) ?? null);
      })
      .catch(() => { if (!cancelled) setActive(null); });
    return () => { cancelled = true; };
  }, [token, activeId]);

  const cover = active?.images?.[0];
  const clientLabel = active
    ? (active.clientName?.trim() || formatPhone(active.clientPhoneNumber) || "Без имени")
    : "Выбрать рецепт";
  const clientHint = active
    ? formatPhone(active.clientPhoneNumber)
      ?? (active.clientTelegramUsername ? `@${active.clientTelegramUsername}` : `Возраст: ${active.patientAge}`)
    : "Нет активной заявки";

  return (
    <button
      type="button"
      onClick={openPicker}
      className="flex items-center gap-2.5 rounded-full bg-surface-container-low px-2 py-1.5 text-left transition hover:bg-surface-container max-w-full"
    >
      <div className="h-8 w-8 flex-shrink-0 overflow-hidden rounded-full bg-surface-container">
        {cover ? (
          <AuthedImage src={cover.url} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-on-surface-variant/50">
            <Icon name="orders" size={14} />
          </div>
        )}
      </div>
      <div className="min-w-0">
        <p className="truncate text-xs font-bold text-on-surface">{clientLabel}</p>
        <p className="truncate text-[10px] text-on-surface-variant">{clientHint}</p>
      </div>
      <Icon name="chevron-down" size={12} className="flex-shrink-0 text-on-surface-variant" />
    </button>
  );
}

function formatPhone(phone?: string | null): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "");
  return digits ? `+992${digits}` : null;
}
