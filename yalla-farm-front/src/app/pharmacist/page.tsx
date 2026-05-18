"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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
import { AuthedImage, Button } from "@/shared/ui";

// Decoded prescriptions deliberately drop off the queue once the pharmacist
// submits the checklist — they're "done" from this person's perspective and
// just create noise on the work list. They remain accessible via the active-
// prescription picker in the header if the pharmacist needs to revisit one.
const STATUS_ORDER: PrescriptionStatus[] = ["InQueue", "InReview"];
const DASHBOARD_STATUSES: PrescriptionStatus[] = [
  "Submitted",
  "AwaitingConfirmation",
  "InQueue",
  "InReview",
  "Decoded",
  "OrderPlaced",
  "MovedToCart",
  "Cancelled",
  "DecodeFailed",
];
const SUCCESS_STATUSES = new Set<PrescriptionStatus>(["Decoded", "OrderPlaced", "MovedToCart"]);
const DUSHANBE_OFFSET_MS = 5 * 60 * 60 * 1000;

type PharmacistTab = "dashboard" | "queue";

function getDushanbeTodayWindow(now = new Date()): { startUtcMs: number; endUtcMs: number; label: string } {
  const shifted = new Date(now.getTime() + DUSHANBE_OFFSET_MS);
  const year = shifted.getUTCFullYear();
  const month = shifted.getUTCMonth();
  const day = shifted.getUTCDate();
  const startUtcMs = Date.UTC(year, month, day) - DUSHANBE_OFFSET_MS;
  const endUtcMs = startUtcMs + 24 * 60 * 60 * 1000;
  const label = `${String(day).padStart(2, "0")}.${String(month + 1).padStart(2, "0")}.${year}`;
  return { startUtcMs, endUtcMs, label };
}

function isInWindow(date: string | null | undefined, startUtcMs: number, endUtcMs: number): boolean {
  if (!date) return false;
  const time = Date.parse(date);
  return Number.isFinite(time) && time >= startUtcMs && time < endUtcMs;
}

export default function PharmacistQueuePage() {
  const token = useAppSelector((s) => s.auth.token);
  const role = useAppSelector((s) => s.auth.role);
  const hydrated = useAppSelector((s) => s.auth.hydrated);
  const router = useRouter();
  const setActiveId = useActivePrescriptionStore((s) => s.setActiveId);

  const [activeTab, setActiveTab] = useState<PharmacistTab>("dashboard");
  const [items, setItems] = useState<ApiPrescription[]>([]);
  // Initial true so we don't flash an empty list while the first fetch is
  // still in flight (the user could click "Взять в работу" on a list that's
  // not yet hydrated). Flips to false after the first response — success or
  // error — and stays false on subsequent silent refetches.
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    if (!hydrated) return;
    if (!token) { router.replace("/login/admin?redirect=/pharmacist"); return; }
    if (role && role !== "Pharmacist") router.replace("/");
  }, [hydrated, token, role, router]);

  useEffect(() => {
    const syncHash = () => {
      const hash = window.location.hash.replace("#", "");
      setActiveTab(hash === "queue" ? "queue" : "dashboard");
    };
    syncHash();
    window.addEventListener("hashchange", syncHash);
    window.addEventListener("popstate", syncHash);
    const interval = window.setInterval(syncHash, 120);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("hashchange", syncHash);
      window.removeEventListener("popstate", syncHash);
    };
  }, []);

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

  // Single entry point — clicking the row's primary button always (a) marks
  // this prescription active in the picker store, (b) takes it into review if
  // it's still in the queue, and (c) opens the cart. The previous flow had a
  // separate "Сделать активным" button that confused pharmacists into a
  // half-assigned state; auto-take here means SuperAdmin's payment confirm
  // → pharmacist click is a single hop straight into decoding.
  async function onOpenCart(p: ApiPrescription) {
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

  const byStatus: Record<PrescriptionStatus, ApiPrescription[]> = {
    Submitted: [], AwaitingConfirmation: [], InQueue: [], InReview: [],
    Decoded: [], OrderPlaced: [], MovedToCart: [], Cancelled: [], DecodeFailed: [],
  };
  for (const p of items) byStatus[p.status]?.push(p);
  // Pending work — sort oldest first so the queue is FIFO; the longest-waiting
  // client gets attention before brand-new requests.
  for (const status of ["InQueue", "InReview"] as PrescriptionStatus[]) {
    byStatus[status].sort((a, b) =>
      new Date(a.createdAtUtc).getTime() - new Date(b.createdAtUtc).getTime()
    );
  }

  const dashboardStats = useMemo(() => {
    const { startUtcMs, endUtcMs, label } = getDushanbeTodayWindow();
    const todayIncoming = items.filter((item) => isInWindow(item.createdAtUtc, startUtcMs, endUtcMs));
    const successful = items.filter((item) =>
      SUCCESS_STATUSES.has(item.status)
      && isInWindow(item.decodedAtUtc || item.updatedAtUtc || item.createdAtUtc, startUtcMs, endUtcMs)
    );
    const cancelled = items.filter((item) =>
      (item.status === "Cancelled" || item.status === "DecodeFailed")
      && isInWindow(item.cancelledAtUtc || item.decodeFailedAtUtc || item.updatedAtUtc || item.createdAtUtc, startUtcMs, endUtcMs)
    );
    const statusCounts = DASHBOARD_STATUSES.reduce<Record<PrescriptionStatus, number>>((acc, status) => {
      acc[status] = todayIncoming.filter((item) => item.status === status).length;
      return acc;
    }, {} as Record<PrescriptionStatus, number>);

    return {
      dayLabel: label,
      total: todayIncoming.length,
      successful: successful.length,
      cancelled: cancelled.length,
      commission: successful.length * 3,
      statusCounts,
    };
  }, [items]);

  return (
    <PharmacistShell>
      <div className="mx-auto max-w-5xl space-y-5">
        <div className="rounded-xl bg-gradient-to-br from-primary to-primary-container px-4 py-3 text-white sm:px-5 sm:py-4">
          <p className="text-[10px] font-bold uppercase tracking-wider opacity-75">Pharmacist Workspace</p>
          <h1 className="mt-1 text-lg font-extrabold sm:text-xl">
            {activeTab === "dashboard" ? "Dashboard" : "Очередь рецептов"}
          </h1>
          <p className="mt-1 max-w-3xl text-xs opacity-85 sm:text-sm">
            {activeTab === "dashboard"
              ? "Ежедневная статистика рецептов и комиссии фармацевта за текущий день по UTC+5."
              : "Выберите заявку, чтобы открыть её корзину и собрать чек-лист."}
          </p>
        </div>

        {error ? (
          <div className="rounded-2xl bg-secondary/10 p-3 text-sm font-semibold text-secondary">{error}</div>
        ) : null}

        {activeTab === "dashboard" ? (
          <PharmacistDashboard stats={dashboardStats} loading={loading} />
        ) : loading ? (
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
                            <div className="h-14 w-14 flex-shrink-0 overflow-hidden rounded-xl bg-image-backdrop">
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
                            <Button
                              size="sm"
                              variant={status === "InQueue" ? "primary" : "secondary"}
                              loading={busyId === p.prescriptionId}
                              onClick={() => onOpenCart(p)}
                            >
                              {status === "InQueue" ? "Взять в работу" : "Открыть корзину"}
                            </Button>
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

function PharmacistDashboard({
  stats,
  loading,
}: {
  stats: {
    dayLabel: string;
    total: number;
    successful: number;
    cancelled: number;
    commission: number;
    statusCounts: Record<PrescriptionStatus, number>;
  };
  loading: boolean;
}) {
  const cards = [
    { label: "Всего пришло", value: stats.total, hint: `UTC+5 · ${stats.dayLabel}`, tone: "text-primary" },
    { label: "Успешные", value: stats.successful, hint: "Decoded / OrderPlaced / MovedToCart", tone: "text-primary" },
    { label: "Отменённые", value: stats.cancelled, hint: "Cancelled и DecodeFailed", tone: "text-secondary" },
    { label: "Комиссия", value: `${stats.commission.toFixed(2)} TJS`, hint: "3 TJS за успешную расшифровку", tone: "text-primary" },
  ];

  return (
    <section className="space-y-4">
      {loading ? (
        <div className="rounded-2xl bg-surface-container-low px-4 py-3 text-sm text-on-surface-variant">
          Обновляем статистику…
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => (
          <div key={card.label} className="stitch-card min-h-[132px] p-4 sm:p-5">
            <p className={`text-3xl font-black ${card.tone}`}>{card.value}</p>
            <p className="mt-3 text-sm font-black uppercase tracking-wider text-on-surface-variant">{card.label}</p>
            <p className="mt-1 text-xs text-on-surface-variant">{card.hint}</p>
          </div>
        ))}
      </div>

      <div className="stitch-card p-4 sm:p-5">
        <h2 className="text-base font-black">Статусы за сегодня</h2>
        <p className="mt-1 text-sm text-on-surface-variant">
          Распределение рецептов, которые пришли сегодня по UTC+5.
        </p>
        <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {DASHBOARD_STATUSES.map((status) => (
            <div key={status} className="flex items-center justify-between rounded-2xl bg-surface-container-low px-3 py-2">
              <span className="text-sm font-bold">{PRESCRIPTION_STATUS_LABEL_RU[status] ?? status}</span>
              <span className="rounded-full bg-surface px-2.5 py-1 text-xs font-black tabular-nums text-primary">
                {stats.statusCounts[status] ?? 0}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function formatPhone(phone?: string | null): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "");
  return digits ? `+992${digits}` : null;
}
