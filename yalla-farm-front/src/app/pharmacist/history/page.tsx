"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAppSelector } from "@/shared/lib/redux";
import { getPharmacistAll } from "@/entities/pharmacist/api";
import {
  PRESCRIPTION_STATUS_LABEL_RU,
  resolvePrescriptionImageUrl,
  type ApiPrescription,
} from "@/entities/prescription/api";
import { useSignalREvent } from "@/shared/lib/useSignalR";
import { PharmacistShell } from "@/widgets/layout/PharmacistShell";
import { PrescriptionDetailsModal } from "@/widgets/pharmacist/PrescriptionDetailsModal";
import { AuthedImage, Button } from "@/shared/ui";

/**
 * Pharmacist work history: every prescription this pharmacist has
 * decoded (status = Decoded), newest first. Each card shows the
 * client, the decode timestamp, the overall comment if any, and
 * the full checklist (medicine name + qty + per-item comment) so the
 * pharmacist can review past work without going through the picker.
 *
 * Live-listens to PrescriptionUpdated so a freshly-decoded prescription
 * shows up here without a manual refresh.
 */
export default function PharmacistHistoryPage() {
  const token = useAppSelector((s) => s.auth.token);
  const role = useAppSelector((s) => s.auth.role);
  const hydrated = useAppSelector((s) => s.auth.hydrated);
  const userId = useAppSelector((s) => s.auth.userId);
  const router = useRouter();

  const [items, setItems] = useState<ApiPrescription[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [detailsId, setDetailsId] = useState<string | null>(null);
  const detailsPrescription = items.find((p) => p.prescriptionId === detailsId) ?? null;

  useEffect(() => {
    if (!hydrated) return;
    if (!token) { router.replace("/login/admin?redirect=/pharmacist/history"); return; }
    if (role && role !== "Pharmacist") router.replace("/");
  }, [hydrated, token, role, router]);

  const load = useCallback(() => {
    if (!token || role !== "Pharmacist") return Promise.resolve();
    setLoading(true); setError(null);
    return getPharmacistAll(token)
      .then((all) => {
        // History view: only the prescriptions this pharmacist personally
        // decoded. The /pharmacist/all endpoint also returns InQueue and
        // InReview rows for the picker, but those don't belong here.
        const mine = all.filter(
          (p) => p.assignedPharmacistId === userId
              && (p.status === "Decoded" || p.status === "OrderPlaced" || p.status === "MovedToCart"),
        );
        // Newest first by decoded-at, falling back to updated/created.
        mine.sort((a, b) => {
          const ta = Date.parse(a.decodedAtUtc || a.updatedAtUtc || a.createdAtUtc);
          const tb = Date.parse(b.decodedAtUtc || b.updatedAtUtc || b.createdAtUtc);
          return tb - ta;
        });
        setItems(mine);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Не удалось загрузить историю."))
      .finally(() => setLoading(false));
  }, [token, role, userId]);

  useEffect(() => { load(); }, [load]);

  // Live refresh — server fans out PrescriptionUpdated to the
  // pharmacist group on every status change.
  useSignalREvent("PrescriptionUpdated", () => { load(); }, token);

  return (
    <PharmacistShell>
      <div className="mx-auto max-w-3xl space-y-3 p-4">
        <h1 className="font-display text-lg font-extrabold">История запросов</h1>
        <p className="text-xs text-on-surface-variant">
          Рецепты, которые вы расшифровали. Нажмите «Подробнее», чтобы открыть карточку — данные доступны только для просмотра.
        </p>

        {error ? (
          <div className="rounded-2xl bg-secondary/10 p-3 text-sm font-semibold text-secondary">{error}</div>
        ) : null}

        {loading && items.length === 0 ? (
          <div className="rounded-2xl bg-surface-container-low p-6 text-sm text-on-surface-variant">Загружаем…</div>
        ) : null}

        {!loading && items.length === 0 ? (
          <div className="rounded-2xl bg-surface-container-low p-6 text-sm text-on-surface-variant">
            Пока ни один рецепт не расшифрован.
          </div>
        ) : null}

        <ul className="space-y-2">
          {items.map((p) => {
            const decodedAt = p.decodedAtUtc || p.updatedAtUtc || p.createdAtUtc;
            const phone = p.clientPhoneNumber?.replace(/\D/g, "");
            const phoneDisplay = phone ? `+992${phone}` : null;
            return (
              <li key={p.prescriptionId} className="rounded-2xl bg-surface-container-lowest p-3 shadow-card">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-primary-soft px-2 py-0.5 text-[10px] font-bold text-primary">
                        {PRESCRIPTION_STATUS_LABEL_RU[p.status] ?? p.status}
                      </span>
                      <span className="text-xs text-on-surface-variant">
                        {new Date(decodedAt).toLocaleString("ru-RU")}
                      </span>
                    </div>
                    <p className="mt-1 text-sm font-bold">
                      {p.clientName?.trim() || "Без имени"}
                      {phoneDisplay ? (
                        <span className="ml-2 font-normal text-on-surface-variant">{phoneDisplay}</span>
                      ) : null}
                      {p.clientTelegramUsername ? (
                        <span className="ml-2 font-normal text-on-surface-variant">@{p.clientTelegramUsername}</span>
                      ) : null}
                    </p>
                    {p.pharmacistOverallComment ? (
                      <p className="mt-1 line-clamp-2 text-xs text-on-surface-variant">
                        {p.pharmacistOverallComment}
                      </p>
                    ) : null}
                  </div>
                  <Button size="sm" variant="secondary" onClick={() => setDetailsId(p.prescriptionId)}>
                    Подробнее
                  </Button>
                </div>

                {/* Quick photo strip — small thumbs so the list scrolls
                    fast even on slow connections. The full-res view
                    happens in the details modal. */}
                {p.images && p.images.length > 0 ? (
                  <div className="mt-2 flex gap-2 overflow-x-auto">
                    {p.images.map((img) => (
                      <div key={img.id} className="relative h-14 w-12 flex-shrink-0 overflow-hidden rounded-md bg-surface-container">
                        <AuthedImage
                          src={resolvePrescriptionImageUrl(img.url)}
                          alt=""
                          lazy
                          className="h-full w-full object-cover"
                        />
                      </div>
                    ))}
                  </div>
                ) : null}

                {/* Items — title resolution: Undecoded → verdict label,
                    manual → ManualMedicineName snapshot, catalog → live
                    MedicineTitle from the response. Catalog rows that
                    somehow lost their title (deactivated medicine, race
                    with rename) fall through to a dash. */}
                {p.items && p.items.length > 0 ? (
                  <ul className="mt-2 space-y-1 text-[11px]">
                    {p.items.map((it) => {
                      const title = it.kind === "Undecoded"
                        ? "Не смог расшифровать"
                        : (it.manualMedicineName || it.medicineTitle || (it.medicineId ? "—" : "Без названия"));
                      return (
                        <li key={it.id} className="flex items-start gap-2">
                          <span className="mt-1 inline-flex h-1.5 w-1.5 flex-shrink-0 rounded-full bg-primary" />
                          <span className="min-w-0 flex-1">
                            <span className="line-clamp-1 font-bold text-on-surface">{title}</span>
                            {it.pharmacistComment ? (
                              <span className="block line-clamp-2 text-on-surface-variant">{it.pharmacistComment}</span>
                            ) : null}
                          </span>
                          <span className="flex-shrink-0 text-on-surface-variant">×{it.quantity}</span>
                        </li>
                      );
                    })}
                  </ul>
                ) : null}
              </li>
            );
          })}
        </ul>
      </div>

      <PrescriptionDetailsModal
        prescription={detailsPrescription}
        onClose={() => setDetailsId(null)}
      />
    </PharmacistShell>
  );
}
