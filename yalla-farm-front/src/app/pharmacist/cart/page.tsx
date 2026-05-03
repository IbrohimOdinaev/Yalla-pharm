"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useAppSelector } from "@/shared/lib/redux";
import {
  getPharmacistPrescription,
  submitChecklist,
} from "@/entities/pharmacist/api";
import {
  PRESCRIPTION_STATUS_LABEL_RU,
  type ApiPrescription,
} from "@/entities/prescription/api";
import { getMedicineById, getMedicineDisplayName, resolveMedicineImageUrl } from "@/entities/medicine/api";
import type { ApiMedicine } from "@/shared/types/api";
import { useActivePrescriptionStore } from "@/features/pharmacist/model/activePrescriptionStore";
import { usePrescriptionDraftStore } from "@/features/pharmacist/model/prescriptionDraftStore";
import { PharmacistShell } from "@/widgets/layout/PharmacistShell";
import { ManualEntryModal } from "@/widgets/pharmacist/ManualEntryModal";
import { AuthedImage, Button, Icon } from "@/shared/ui";

export default function PharmacistCartPage() {
  const router = useRouter();
  const token = useAppSelector((s) => s.auth.token);
  const role = useAppSelector((s) => s.auth.role);
  const hydrated = useAppSelector((s) => s.auth.hydrated);

  const activeId = useActivePrescriptionStore((s) => s.activeId);
  const openPicker = useActivePrescriptionStore((s) => s.openPicker);

  const drafts = usePrescriptionDraftStore((s) => s.drafts);
  const updateItem = usePrescriptionDraftStore((s) => s.updateItem);
  const removeItem = usePrescriptionDraftStore((s) => s.removeItem);
  const setOverallComment = usePrescriptionDraftStore((s) => s.setOverallComment);
  const clearDraft = usePrescriptionDraftStore((s) => s.clearDraft);
  const addItem = usePrescriptionDraftStore((s) => s.addItem);

  const [prescription, setPrescription] = useState<ApiPrescription | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [medicineCache, setMedicineCache] = useState<Record<string, ApiMedicine>>({});
  const [showManual, setShowManual] = useState(false);
  const [editingCommentFor, setEditingCommentFor] = useState<string | null>(null);

  useEffect(() => {
    if (!hydrated) return;
    if (!token) { router.replace("/login/admin?redirect=/pharmacist"); return; }
    if (role && role !== "Pharmacist") router.replace("/");
  }, [hydrated, token, role, router]);

  const load = useCallback(() => {
    if (!token || role !== "Pharmacist" || !activeId) { setPrescription(null); return; }
    setLoading(true); setError(null);
    return getPharmacistPrescription(token, activeId)
      .then(setPrescription)
      .catch((err) => setError(err instanceof Error ? err.message : "Не удалось загрузить рецепт."))
      .finally(() => setLoading(false));
  }, [token, role, activeId]);

  useEffect(() => { load(); }, [load]);

  const draft = activeId ? (drafts[activeId] ?? { overallComment: "", items: [] }) : { overallComment: "", items: [] };

  // Hydrate the local draft from a previously-decoded server checklist on
  // first open so the pharmacist can review/continue past work without
  // re-entering everything.
  useEffect(() => {
    if (!activeId || !prescription) return;
    const cur = drafts[activeId];
    if (cur && cur.items.length > 0) return;
    if (prescription.items.length === 0 && !prescription.pharmacistOverallComment) return;
    if (prescription.pharmacistOverallComment) {
      setOverallComment(activeId, prescription.pharmacistOverallComment);
    }
    for (const it of prescription.items) {
      addItem(activeId, {
        draftId: it.id,
        medicineId: it.medicineId ?? null,
        manualMedicineName: it.manualMedicineName ?? null,
        quantity: it.quantity,
        pharmacistComment: it.pharmacistComment ?? null,
        displayTitle: it.manualMedicineName || it.medicineId || "",
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prescription?.prescriptionId]);

  // Fetch medicine objects for catalog-bound draft items so the cart row
  // can show the photo + canonical title. Skipped for manual items.
  useEffect(() => {
    const missing = draft.items
      .map((i) => i.medicineId)
      .filter((id): id is string => !!id && !medicineCache[id]);
    if (missing.length === 0) return;
    let cancelled = false;
    Promise.all(missing.map((id) =>
      getMedicineById(id).then((m) => [id, m] as const).catch(() => [id, null] as const)
    )).then((entries) => {
      if (cancelled) return;
      setMedicineCache((prev) => {
        const next = { ...prev };
        for (const [id, m] of entries) if (m) next[id] = m;
        return next;
      });
    });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft.items.length, draft.items.map((i) => i.medicineId).join(",")]);

  const phone = useMemo(() => {
    const p = prescription?.clientPhoneNumber?.replace(/\D/g, "");
    return p ? `+992${p}` : null;
  }, [prescription]);

  function onAddManual(input: { name: string; quantity: number; comment: string | null }) {
    if (!activeId) return;
    addItem(activeId, {
      draftId: `man-${Date.now()}`,
      medicineId: null,
      manualMedicineName: input.name,
      quantity: input.quantity,
      pharmacistComment: input.comment,
      displayTitle: input.name,
    });
  }

  async function onSubmit() {
    if (!token || !activeId) return;
    if (draft.items.length === 0) {
      setError("Добавьте хотя бы одну позицию.");
      return;
    }
    setError(null); setSubmitting(true);
    try {
      await submitChecklist(token, activeId, {
        overallComment: draft.overallComment.trim() || null,
        items: draft.items.map((i) => ({
          medicineId: i.medicineId ?? null,
          manualMedicineName: i.manualMedicineName ?? null,
          quantity: i.quantity,
          pharmacistComment: i.pharmacistComment ?? null,
        })),
      });
      clearDraft(activeId);
      router.replace("/pharmacist");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось отправить чек-лист.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <PharmacistShell>
      <div className="mx-auto max-w-3xl space-y-4">
        {!activeId ? (
          <div className="rounded-2xl bg-surface-container-low p-6 text-sm text-on-surface-variant">
            Активный рецепт не выбран. Откройте очередь или нажмите на «Выбрать рецепт» в шапке.
            <div className="mt-3 flex gap-2">
              <Button size="sm" variant="secondary" onClick={openPicker}>Выбрать рецепт</Button>
            </div>
          </div>
        ) : null}

        {error ? (
          <div className="rounded-2xl bg-secondary/10 p-3 text-sm font-semibold text-secondary">{error}</div>
        ) : null}

        {activeId && loading ? (
          <div className="rounded-2xl bg-surface-container-low p-6 text-sm text-on-surface-variant">Загружаем…</div>
        ) : null}

        {activeId && prescription ? (
          <>
            {/* Client + photos */}
            <section className="space-y-3 rounded-2xl bg-surface-container-lowest p-4 shadow-card">
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="rounded-full bg-primary-soft px-2 py-1 font-bold text-primary">
                  {PRESCRIPTION_STATUS_LABEL_RU[prescription.status] ?? prescription.status}
                </span>
                <span className="text-on-surface-variant">
                  Возраст: <span className="font-bold text-on-surface">{prescription.patientAge}</span>
                </span>
                <span className="text-on-surface-variant">
                  {new Date(prescription.createdAtUtc).toLocaleString("ru-RU")}
                </span>
              </div>
              <p className="text-sm">
                <span className="font-semibold text-on-surface-variant">Клиент: </span>
                <span className="font-bold">{prescription.clientName?.trim() || "Без имени"}</span>
                {phone ? <span className="ml-2 text-on-surface-variant">{phone}</span> : null}
                {prescription.clientTelegramUsername ? (
                  <span className="ml-2 text-on-surface-variant">@{prescription.clientTelegramUsername}</span>
                ) : null}
              </p>
              {prescription.clientComment ? (
                <p className="text-xs">
                  <span className="font-semibold text-on-surface-variant">Коммент клиента: </span>
                  {prescription.clientComment}
                </p>
              ) : null}
              <div className="grid grid-cols-2 gap-3">
                {prescription.images.map((img) => (
                  <div key={img.id} className="relative aspect-[3/4] overflow-hidden rounded-2xl bg-surface-container">
                    <AuthedImage src={img.url} alt="" className="h-full w-full object-cover" />
                  </div>
                ))}
              </div>
            </section>

            {/* Cart items */}
            <section className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <h2 className="font-display text-base font-extrabold">Корзина рецепта</h2>
                <Button size="sm" variant="secondary" onClick={() => setShowManual(true)}>
                  + Препарат вручную
                </Button>
              </div>
              {draft.items.length === 0 ? (
                <div className="rounded-2xl bg-surface-container-low p-4 text-xs text-on-surface-variant">
                  Корзина пуста. Откройте «Каталог», чтобы добавить лекарства, или нажмите
                  «+ Препарат вручную» для препарата вне нашего каталога.
                </div>
              ) : (
                <ul className="space-y-2">
                  {draft.items.map((it) => {
                    const med = it.medicineId ? medicineCache[it.medicineId] : undefined;
                    const imgUrl = med ? resolveMedicineImageUrl(med, 120) : "";
                    const title = med ? getMedicineDisplayName(med) : it.displayTitle;
                    const isCommentOpen = editingCommentFor === it.draftId;
                    return (
                      <li key={it.draftId} className="rounded-2xl bg-surface-container-lowest p-3 shadow-card">
                        <div className="flex items-center gap-3">
                          <div className="h-12 w-12 flex-shrink-0 overflow-hidden rounded-xl bg-surface-container xs:h-14 xs:w-14">
                            {imgUrl ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={imgUrl} alt="" className="h-full w-full object-contain mix-blend-multiply" />
                            ) : (
                              <div className="flex h-full w-full items-center justify-center text-on-surface-variant/40">
                                <Icon name="pharmacy" size={18} />
                              </div>
                            )}
                          </div>

                          <div className="min-w-0 flex-1">
                            <p className="line-clamp-2 text-sm font-bold leading-tight">
                              {title}
                              {!it.medicineId ? (
                                <span className="ml-2 rounded-full bg-warning-soft px-2 py-0.5 text-[10px] font-bold text-warning">
                                  Нет в каталоге
                                </span>
                              ) : null}
                            </p>
                            {it.pharmacistComment ? (
                              <p className="mt-0.5 line-clamp-2 text-[11px] text-on-surface-variant">{it.pharmacistComment}</p>
                            ) : null}
                          </div>

                          {/* Qty stepper */}
                          <div className="flex flex-shrink-0 items-center gap-0.5 rounded-full bg-surface-container-low p-0.5">
                            <button
                              type="button"
                              onClick={() => updateItem(activeId, it.draftId, { quantity: Math.max(1, it.quantity - 1) })}
                              className="flex h-7 w-7 items-center justify-center rounded-full text-primary transition hover:bg-primary/10 active:scale-95"
                              aria-label="Меньше"
                            >
                              <Icon name="minus" size={14} />
                            </button>
                            <span className="min-w-[1.5rem] text-center text-xs font-extrabold tabular-nums">
                              {it.quantity}
                            </span>
                            <button
                              type="button"
                              onClick={() => updateItem(activeId, it.draftId, { quantity: it.quantity + 1 })}
                              className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-white transition hover:bg-primary-container active:scale-95"
                              aria-label="Больше"
                            >
                              <Icon name="plus" size={14} />
                            </button>
                          </div>

                          <button
                            type="button"
                            onClick={() => setEditingCommentFor(isCommentOpen ? null : it.draftId)}
                            className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-on-surface-variant transition hover:bg-surface-container"
                            aria-label="Комментарий"
                            title="Комментарий по позиции"
                          >
                            <Icon name="orders" size={14} />
                          </button>

                          <button
                            type="button"
                            onClick={() => removeItem(activeId, it.draftId)}
                            className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-on-surface-variant transition hover:bg-secondary-soft hover:text-secondary"
                            aria-label="Удалить"
                          >
                            <Icon name="close" size={14} />
                          </button>
                        </div>

                        {isCommentOpen ? (
                          <input
                            type="text"
                            placeholder="Как принимать, замены и т.п."
                            value={it.pharmacistComment ?? ""}
                            onChange={(e) => updateItem(activeId, it.draftId, { pharmacistComment: e.target.value })}
                            className="stitch-input mt-2 w-full text-xs"
                          />
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>

            {/* Overall comment */}
            <section className="space-y-2">
              <label className="block text-sm font-bold">Общий комментарий клиенту</label>
              <textarea
                value={draft.overallComment}
                onChange={(e) => setOverallComment(activeId, e.target.value)}
                rows={4}
                maxLength={2000}
                className="w-full rounded-2xl border border-outline bg-surface-container-lowest p-3 text-sm focus:border-primary focus:outline-none"
              />
            </section>

            {prescription.status === "InReview" ? (
              <Button size="lg" fullWidth loading={submitting} onClick={onSubmit}>
                Отправить чек-лист клиенту
              </Button>
            ) : prescription.status === "InQueue" ? (
              <div className="rounded-2xl bg-warning-soft p-4 text-sm text-on-surface">
                Заявка ещё в очереди. Откройте «Очередь» и нажмите «Взять в работу», чтобы продолжить.
              </div>
            ) : (
              <div className="rounded-2xl bg-surface-container-low p-4 text-sm text-on-surface-variant">
                {PRESCRIPTION_STATUS_LABEL_RU[prescription.status]} — отправка чек-листа недоступна.
              </div>
            )}
          </>
        ) : null}

        <ManualEntryModal
          open={showManual}
          onClose={() => setShowManual(false)}
          onSubmit={onAddManual}
        />
      </div>
    </PharmacistShell>
  );
}
