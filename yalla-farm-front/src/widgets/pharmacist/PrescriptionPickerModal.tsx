"use client";

import { useCallback, useEffect, useState } from "react";
import { useAppSelector } from "@/shared/lib/redux";
import { useActivePrescriptionStore } from "@/features/pharmacist/model/activePrescriptionStore";
import { getPharmacistAll } from "@/entities/pharmacist/api";
import {
  PRESCRIPTION_STATUS_LABEL_RU,
  type ApiPrescription,
  type PrescriptionStatus,
} from "@/entities/prescription/api";
import { useSignalREvent } from "@/shared/lib/useSignalR";
import { AuthedImage, Icon } from "@/shared/ui";

const STATUS_ORDER: PrescriptionStatus[] = ["InQueue", "InReview", "Decoded"];

/**
 * Modal opened from the header pill. Shows a status-grouped list of every
 * prescription visible to the current pharmacist (open queue + own
 * in-review + own decoded). Selecting one updates the active store and
 * closes the modal.
 */
export function PrescriptionPickerModal() {
  const token = useAppSelector((s) => s.auth.token);
  const role = useAppSelector((s) => s.auth.role);
  const isOpen = useActivePrescriptionStore((s) => s.isPickerOpen);
  const closePicker = useActivePrescriptionStore((s) => s.closePicker);
  const setActiveId = useActivePrescriptionStore((s) => s.setActiveId);
  const activeId = useActivePrescriptionStore((s) => s.activeId);

  const [items, setItems] = useState<ApiPrescription[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    if (!token || role !== "Pharmacist") return Promise.resolve();
    setLoading(true); setError(null);
    return getPharmacistAll(token)
      .then(setItems)
      .catch((err) => setError(err instanceof Error ? err.message : "Ошибка загрузки."))
      .finally(() => setLoading(false));
  }, [token, role]);

  useEffect(() => {
    if (!isOpen) return;
    load();
  }, [isOpen, load]);

  // Refresh the picker live so the moment another pharmacist grabs an
  // InQueue request (or SuperAdmin confirms a new one) the open modal
  // reflects it without requiring a re-open.
  useSignalREvent("PrescriptionUpdated", load, isOpen ? token : null);

  if (!isOpen) return null;

  function pick(id: string) {
    setActiveId(id);
    closePicker();
  }

  // Group by status for visual clarity — same ordering across renders.
  const byStatus: Record<PrescriptionStatus, ApiPrescription[]> = {
    Submitted: [], AwaitingConfirmation: [], InQueue: [], InReview: [],
    Decoded: [], OrderPlaced: [], MovedToCart: [], Cancelled: [],
  };
  for (const p of items) byStatus[p.status]?.push(p);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-on-surface/40 sm:items-center"
      onClick={closePicker}
    >
      <div
        className="flex w-full max-w-2xl flex-col rounded-t-3xl bg-surface-container-lowest shadow-float sm:rounded-3xl max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 border-b border-outline/40 p-4">
          <h2 className="font-display text-lg font-extrabold">Выберите рецепт</h2>
          <button
            type="button"
            onClick={closePicker}
            className="flex h-8 w-8 items-center justify-center rounded-full text-on-surface-variant transition hover:bg-surface-container"
            aria-label="Закрыть"
          >
            <Icon name="close" size={16} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {error ? (
            <div className="rounded-2xl bg-secondary/10 p-3 text-sm font-semibold text-secondary">{error}</div>
          ) : null}

          {loading ? (
            <div className="rounded-2xl bg-surface-container-low p-6 text-sm text-on-surface-variant">
              Загружаем…
            </div>
          ) : items.length === 0 ? (
            <div className="rounded-2xl bg-surface-container-low p-6 text-sm text-on-surface-variant">
              Нет рецептов. Заявки появятся, как только SuperAdmin подтвердит оплату.
            </div>
          ) : (
            <div className="space-y-5">
              {STATUS_ORDER.map((status) => {
                const list = byStatus[status];
                if (!list || list.length === 0) return null;
                return (
                  <section key={status} className="space-y-2">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                      {PRESCRIPTION_STATUS_LABEL_RU[status]} · {list.length}
                    </h3>
                    <ul className="space-y-2">
                      {list.map((p) => {
                        const cover = p.images[0];
                        const isActive = p.prescriptionId === activeId;
                        const phone = formatPhone(p.clientPhoneNumber);
                        const tg = p.clientTelegramUsername ? `@${p.clientTelegramUsername}` : null;
                        return (
                          <li key={p.prescriptionId}>
                            <button
                              type="button"
                              onClick={() => pick(p.prescriptionId)}
                              className={`flex w-full items-center gap-3 rounded-2xl p-3 text-left transition ${
                                isActive
                                  ? "bg-primary-soft ring-2 ring-primary"
                                  : "bg-surface-container-low hover:bg-surface-container"
                              }`}
                            >
                              <div className="h-12 w-12 flex-shrink-0 overflow-hidden rounded-xl bg-surface-container">
                                {cover ? (
                                  <AuthedImage src={cover.url} alt="" className="h-full w-full object-cover" />
                                ) : null}
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-sm font-bold">
                                  {p.clientName?.trim() || phone || tg || "Без имени"}
                                </p>
                                <p className="truncate text-xs text-on-surface-variant">
                                  {[phone, tg, `Возраст: ${p.patientAge}`].filter(Boolean).join(" · ")}
                                </p>
                              </div>
                              <Icon name="chevron-right" size={16} className="flex-shrink-0 text-on-surface-variant" />
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  </section>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function formatPhone(phone?: string | null): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "");
  return digits ? `+992${digits}` : null;
}
