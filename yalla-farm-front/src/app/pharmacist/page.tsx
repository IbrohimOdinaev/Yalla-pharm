"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAppSelector } from "@/shared/lib/redux";
import { getPharmacistAll, takePrescriptionIntoReview } from "@/entities/pharmacist/api";
import {
  PRESCRIPTION_STATUS_LABEL_RU,
  type ApiPrescription,
  type PrescriptionStatus,
} from "@/entities/prescription/api";
import { useActivePrescriptionStore } from "@/features/pharmacist/model/activePrescriptionStore";
import { useSignalREvent } from "@/shared/lib/useSignalR";
import { PharmacistShell } from "@/widgets/layout/PharmacistShell";
import { AuthedImage, Button, Icon } from "@/shared/ui";

const STATUS_ORDER: PrescriptionStatus[] = ["InQueue", "InReview", "Decoded"];

export default function PharmacistQueuePage() {
  const token = useAppSelector((s) => s.auth.token);
  const role = useAppSelector((s) => s.auth.role);
  const hydrated = useAppSelector((s) => s.auth.hydrated);
  const router = useRouter();
  const setActiveId = useActivePrescriptionStore((s) => s.setActiveId);

  const [items, setItems] = useState<ApiPrescription[]>([]);
  // Initial false → empty state shows immediately if the API resolves to an
  // empty list. Only flips to true while a fetch is genuinely in flight.
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    if (!hydrated) return;
    if (!token) { router.replace("/login/admin?redirect=/pharmacist"); return; }
    if (role && role !== "Pharmacist") router.replace("/");
  }, [hydrated, token, role, router]);

  const load = useCallback(() => {
    if (!token || role !== "Pharmacist") return Promise.resolve();
    setLoading(true); setError(null);
    return getPharmacistAll(token)
      .then(setItems)
      .catch((err) => setError(err instanceof Error ? err.message : "Не удалось загрузить очередь."))
      .finally(() => setLoading(false));
  }, [token, role]);

  useEffect(() => { load(); }, [load]);

  // Live updates — every PrescriptionUpdated event triggers a refetch so the
  // queue/review/decoded sections stay in sync without manual reload. The
  // hub broadcasts to every connected pharmacist so a refetch is the only
  // safe response (we don't know which prescription shifted lists).
  useSignalREvent("PrescriptionUpdated", load, token);

  async function onSelectAndTake(p: ApiPrescription) {
    setActiveId(p.prescriptionId);
    if (p.status === "InQueue" && token) {
      setBusyId(p.prescriptionId);
      try {
        await takePrescriptionIntoReview(token, p.prescriptionId);
        await load();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Не удалось взять в работу.");
      } finally {
        setBusyId(null);
      }
    }
    router.push("/pharmacist/cart");
  }

  function onJustSelect(p: ApiPrescription) {
    setActiveId(p.prescriptionId);
    router.push("/pharmacist/cart");
  }

  const byStatus: Record<PrescriptionStatus, ApiPrescription[]> = {
    Submitted: [], AwaitingConfirmation: [], InQueue: [], InReview: [],
    Decoded: [], OrderPlaced: [], MovedToCart: [], Cancelled: [],
  };
  for (const p of items) byStatus[p.status]?.push(p);

  return (
    <PharmacistShell>
      <div className="mx-auto max-w-3xl space-y-5">
        <div className="rounded-2xl bg-gradient-to-br from-primary to-primary-container p-5 text-white">
          <p className="text-[10px] font-bold uppercase tracking-widest opacity-60">Pharmacist</p>
          <h1 className="text-xl font-extrabold">Очередь рецептов</h1>
          <p className="mt-1 text-sm opacity-80">
            Выберите заявку, чтобы открыть её корзину и собрать чек-лист.
          </p>
        </div>

        {error ? (
          <div className="rounded-2xl bg-secondary/10 p-3 text-sm font-semibold text-secondary">{error}</div>
        ) : null}

        {loading ? (
          <div className="rounded-2xl bg-surface-container-low p-6 text-sm text-on-surface-variant">
            Загружаем…
          </div>
        ) : items.length === 0 ? (
          <div className="rounded-2xl bg-surface-container-low p-6 text-sm text-on-surface-variant">
            Очередь пуста. Заявки появятся, когда SuperAdmin подтвердит оплату.
          </div>
        ) : (
          <div className="space-y-6">
            {STATUS_ORDER.map((status) => {
              const list = byStatus[status];
              if (!list || list.length === 0) return null;
              return (
                <section key={status} className="space-y-3">
                  <h2 className="font-display text-base font-extrabold">
                    {PRESCRIPTION_STATUS_LABEL_RU[status]} · {list.length}
                  </h2>
                  <ul className="space-y-2">
                    {list.map((p) => {
                      const cover = p.images[0];
                      const phone = formatPhone(p.clientPhoneNumber);
                      const tg = p.clientTelegramUsername ? `@${p.clientTelegramUsername}` : null;
                      const created = new Date(p.createdAtUtc).toLocaleString("ru-RU");
                      return (
                        <li key={p.prescriptionId} className="rounded-2xl bg-surface-container-lowest p-3 shadow-card xs:p-4">
                          <div className="flex items-start gap-3">
                            <div className="h-14 w-14 flex-shrink-0 overflow-hidden rounded-xl bg-surface-container">
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
                              <p className="mt-0.5 text-[11px] text-on-surface-variant/70">{created}</p>
                            </div>
                          </div>
                          <div className="mt-3 flex items-center gap-2">
                            {status === "InQueue" ? (
                              <Button
                                size="sm"
                                loading={busyId === p.prescriptionId}
                                onClick={() => onSelectAndTake(p)}
                              >
                                Взять в работу
                              </Button>
                            ) : (
                              <Button size="sm" variant="secondary" onClick={() => onJustSelect(p)}>
                                Открыть корзину
                              </Button>
                            )}
                            <button
                              type="button"
                              onClick={() => { setActiveId(p.prescriptionId); }}
                              className="ml-auto flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-semibold text-on-surface-variant transition hover:bg-surface-container"
                            >
                              <Icon name="orders" size={14} />
                              Сделать активным
                            </button>
                          </div>
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
    </PharmacistShell>
  );
}

function formatPhone(phone?: string | null): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "");
  return digits ? `+992${digits}` : null;
}
