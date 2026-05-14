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
  PRESCRIPTION_TIER_LABEL_RU,
  PRESCRIPTION_TIER_DESCRIPTION_RU,
  type ApiPrescription,
} from "@/entities/prescription/api";
import { getMedicinesByIds, getMedicineDisplayName, resolveMedicineImageUrl } from "@/entities/medicine/api";
import type { ApiMedicine } from "@/shared/types/api";
import { useActivePrescriptionStore } from "@/features/pharmacist/model/activePrescriptionStore";
import { usePrescriptionDraftStore, type DraftItem } from "@/features/pharmacist/model/prescriptionDraftStore";
import { PharmacistShell } from "@/widgets/layout/PharmacistShell";
import { ManualEntryModal } from "@/widgets/pharmacist/ManualEntryModal";
import { ManualLookupPanel } from "@/widgets/pharmacist/ManualLookupPanel";
import { AuthedImageLightbox } from "@/widgets/prescription/AuthedImageLightbox";
import { AuthedImage, Button, Icon } from "@/shared/ui";

export default function PharmacistCartPage() {
  const router = useRouter();
  const token = useAppSelector((s) => s.auth.token);
  const role = useAppSelector((s) => s.auth.role);
  const hydrated = useAppSelector((s) => s.auth.hydrated);

  const activeId = useActivePrescriptionStore((s) => s.activeId);
  const setActiveId = useActivePrescriptionStore((s) => s.setActiveId);
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

  // Pair-from-cart analog flow: opens a modal listing the OTHER items
  // already in the cart so the pharmacist can pick one as the analog of
  // a given original. The chosen sibling stays in its position in the
  // list (its draft row remains) but visually folds into the original's
  // pair block. Replaces the v1 catalog-pick navigation entirely.
  const [pairModalSourceId, setPairModalSourceId] = useState<string | null>(null);
  const [editingCommentFor, setEditingCommentFor] = useState<string | null>(null);
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);

  useEffect(() => {
    if (!hydrated) return;
    if (!token) { router.replace("/login/admin?redirect=/pharmacist"); return; }
    if (role && role !== "Pharmacist") router.replace("/");
  }, [hydrated, token, role, router]);

  const load = useCallback(() => {
    if (!token || role !== "Pharmacist" || !activeId) { setPrescription(null); return; }
    setLoading(true); setError(null);
    return getPharmacistPrescription(token, activeId)
      .then((p) => {
        // Decoded / OrderPlaced / MovedToCart / Cancelled prescriptions are
        // frozen — the pharmacist already submitted the checklist. Reopening
        // them in the active cart would let them edit a finished submission,
        // so we redirect to /pharmacist/history (read-only "Подробнее" modal)
        // instead of rendering the editable view.
        if (p.status === "Decoded" || p.status === "OrderPlaced"
          || p.status === "MovedToCart" || p.status === "Cancelled") {
          setActiveId(null);
          setPrescription(null);
          router.replace("/pharmacist/history");
          return;
        }
        setPrescription(p);
      })
      .catch((err) => {
        // A stale activeId in localStorage (prescription removed / reassigned /
        // no longer accessible to this pharmacist) used to surface the raw
        // backend "Требуется авторизация" wall. Detect that case and silently
        // drop the stale id so the page falls back to the empty-state with
        // the picker, matching what a pharmacist who just logged in sees.
        const message = err instanceof Error ? err.message : "";
        const isStale = /авторизация|forbidden|not found|denied|401|403|404/i.test(message);
        if (isStale) {
          setActiveId(null);
          setPrescription(null);
        } else {
          setError(message || "Не удалось загрузить рецепт.");
        }
      })
      .finally(() => setLoading(false));
  }, [token, role, activeId, setActiveId, router]);

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
    // First pass — add every server item using its server id as the draftId
    // so cross-references stay stable. Pair links are restored on second
    // pass below: the AnalogItemId on a server row maps 1:1 to the same
    // string we pass as draftId here.
    for (const it of prescription.items) {
      addItem(activeId, {
        draftId: it.id,
        medicineId: it.medicineId ?? null,
        manualMedicineName: it.manualMedicineName ?? null,
        quantity: it.quantity,
        pharmacistComment: it.pharmacistComment ?? null,
        displayTitle: it.manualMedicineName || it.medicineId || "",
        kind: it.kind === "Undecoded" ? "Undecoded" : "Original",
        lookupRequestId: it.lookupRequestId ?? null,
        useUnitMode: it.useUnitMode ?? false,
        unitCount: it.unitCount ?? null,
        unitTotalPrice: it.unitTotalPrice ?? null,
      });
    }
    for (const it of prescription.items) {
      if (it.analogItemId) {
        // updateItem is a closure over the store — safe to call right after
        // addItem since both write to the same Zustand draft.
        updateItem(activeId, it.id, { analogDraftId: it.analogItemId });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prescription?.prescriptionId]);

  // Fetch medicine objects for catalog-bound draft items so the cart row can
  // show the photo + canonical title. Skipped for manual items. Single batch
  // round-trip via /by-ids — the previous N parallel GETs added up to a
  // visible delay even with parallelism (each request still pays its own
  // TCP/TLS overhead).
  useEffect(() => {
    const missing = draft.items
      .map((i) => i.medicineId)
      .filter((id): id is string => !!id && !medicineCache[id]);
    if (missing.length === 0) return;
    let cancelled = false;
    getMedicinesByIds(missing)
      .then((meds) => {
        if (cancelled) return;
        setMedicineCache((prev) => {
          const next = { ...prev };
          for (const m of meds) next[m.id] = m;
          return next;
        });
      })
      .catch(() => undefined);
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
      // Validate unit-mode fields before sending — domain layer would
      // reject these too, but a client-side check yields a friendlier
      // error message.
      for (const i of draft.items) {
        if (!i.useUnitMode) continue;
        if (i.kind === "Undecoded") {
          setError("Поштучный расчёт недоступен для нерасшифрованных позиций.");
          setSubmitting(false);
          return;
        }
        if (!i.unitCount || i.unitCount < 1
          || !i.unitTotalPrice || i.unitTotalPrice <= 0) {
          setError(`У позиции «${i.displayTitle}» заполните количество единиц и сумму.`);
          setSubmitting(false);
          return;
        }
      }
      // Backend's DecodePrescriptionRequest takes a flat list and references
      // pairs by INDEX into that list. Build a draftId → array-index map
      // first, then translate each row's analogDraftId to analogIndex.
      // Skip the link if the partner draft was deleted in-flight.
      const indexByDraftId = new Map<string, number>();
      draft.items.forEach((i, idx) => indexByDraftId.set(i.draftId, idx));
      await submitChecklist(token, activeId, {
        overallComment: draft.overallComment.trim() || null,
        items: draft.items.map((i) => {
          const partnerIdx = i.kind !== "Undecoded" && i.analogDraftId
            ? indexByDraftId.get(i.analogDraftId) ?? null
            : null;
          return {
            medicineId: i.medicineId ?? null,
            manualMedicineName: i.manualMedicineName ?? null,
            quantity: i.quantity,
            pharmacistComment: i.pharmacistComment ?? null,
            kind: i.kind === "Undecoded" ? 1 : 0,
            analogIndex: partnerIdx,
            // Carry the lookup binding through so the server can close
            // the request + materialise shadow medicines/offers
            // atomically with the checklist submit.
            lookupRequestId: i.lookupRequestId ?? null,
            useUnitMode: i.useUnitMode === true,
            unitCount: i.useUnitMode ? i.unitCount ?? null : null,
            unitTotalPrice: i.useUnitMode ? i.unitTotalPrice ?? null : null,
          };
        }),
      });
      // Drop active id + draft + cached prescription so the next visit to this
      // page renders an empty "Рецепт ещё не выбран" state instead of the
      // prescription we just decoded (the bug that showed the old client's
      // photos and items lingering after submit).
      clearDraft(activeId);
      setActiveId(null);
      setPrescription(null);
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
            Рецепт ещё не выбран. Откройте «Очередь», чтобы взять заявку в работу, либо нажмите «Выбрать рецепт» в шапке.
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
                {prescription.preferenceTier ? (
                  <span
                    className="rounded-full bg-accent-sun px-2 py-1 font-bold text-accent-sun-ink"
                    title={PRESCRIPTION_TIER_DESCRIPTION_RU[prescription.preferenceTier]}
                  >
                    {PRESCRIPTION_TIER_LABEL_RU[prescription.preferenceTier]}
                  </span>
                ) : null}
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
              {prescription.clientContacts ? (
                <p className="text-xs">
                  <span className="font-semibold text-on-surface-variant">Контакты для связи: </span>
                  <span className="font-medium">{prescription.clientContacts}</span>
                  <span className="ml-1 text-on-surface-variant/80">
                    — клиент оставил для уточнения данных о рецепте.
                  </span>
                </p>
              ) : null}
              <div className="grid grid-cols-2 gap-3">
                {prescription.images.map((img) => (
                  <button
                    key={img.id}
                    type="button"
                    onClick={() => setLightboxSrc(img.url)}
                    className="relative aspect-[3/4] overflow-hidden rounded-2xl bg-image-backdrop transition hover:opacity-90 active:scale-[0.99]"
                    aria-label="Открыть фото на весь экран"
                  >
                    <AuthedImage
                      src={img.url}
                      alt=""
                      className="h-full w-full object-cover"
                      fallback={
                        <div className="flex h-full w-full items-center justify-center">
                          <div className="h-7 w-7 animate-spin rounded-full border-2 border-on-surface-variant/20 border-t-on-surface-variant/70" />
                        </div>
                      }
                    />
                  </button>
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
              ) : (() => {
                // Build pair-lookup tables once per render. `analogDraftIds` is
                // the set of draftIds that are referenced AS analogs by some
                // other row — those rows fold into their original's pair
                // block instead of appearing as standalone list items.
                const draftById: Record<string, DraftItem> = {};
                for (const it of draft.items) draftById[it.draftId] = it;
                const analogDraftIds = new Set<string>();
                for (const it of draft.items) {
                  if (it.analogDraftId && draftById[it.analogDraftId]) {
                    analogDraftIds.add(it.analogDraftId);
                  }
                }
                return (
                  <ul className="space-y-2">
                    {draft.items.map((it) => {
                      // Hidden — this row is rendered inside its original's pair block.
                      if (analogDraftIds.has(it.draftId)) return null;
                      const analog = it.analogDraftId ? draftById[it.analogDraftId] : null;
                      if (analog) {
                        return (
                          <li
                            key={it.draftId}
                            className="rounded-2xl border-2 border-primary/40 bg-primary-soft p-2 shadow-card"
                          >
                            <div className="mb-1 flex items-center justify-between px-2 pt-1">
                              <span className="text-[10px] font-extrabold uppercase tracking-wider text-primary">
                                Пара (аналог + оригинал)
                              </span>
                              <button
                                type="button"
                                onClick={() => updateItem(activeId, it.draftId, { analogDraftId: null })}
                                className="flex h-6 items-center gap-1 rounded-full bg-surface-container-lowest px-2 text-[10px] font-bold text-on-surface-variant hover:text-secondary"
                              >
                                <Icon name="close" size={10} /> Разъединить
                              </button>
                            </div>
                            {/* Analog on top — visually amped up per spec. */}
                            <DraftRow
                              it={analog}
                              role="analog"
                              activeId={activeId}
                              medicineCache={medicineCache}
                              onUpdate={updateItem}
                              onRemove={removeItem}
                              onToggleComment={(id) => setEditingCommentFor((cur) => cur === id ? null : id)}
                              isCommentOpen={editingCommentFor === analog.draftId}
                              onPair={() => setPairModalSourceId(it.draftId)}
                            />
                            <div className="mx-2 my-1 h-px bg-primary/30" />
                            <DraftRow
                              it={it}
                              role="original"
                              activeId={activeId}
                              medicineCache={medicineCache}
                              onUpdate={updateItem}
                              onRemove={removeItem}
                              onToggleComment={(id) => setEditingCommentFor((cur) => cur === id ? null : id)}
                              isCommentOpen={editingCommentFor === it.draftId}
                              onPair={() => setPairModalSourceId(it.draftId)}
                            />
                          </li>
                        );
                      }
                      // Singleton row (no pair).
                      return (
                        <li key={it.draftId} className="rounded-2xl bg-surface-container-lowest p-3 shadow-card">
                          <DraftRow
                            it={it}
                            role="solo"
                            activeId={activeId}
                            medicineCache={medicineCache}
                            onUpdate={updateItem}
                            onRemove={removeItem}
                            onToggleComment={(id) => setEditingCommentFor((cur) => cur === id ? null : id)}
                            isCommentOpen={editingCommentFor === it.draftId}
                            onPair={() => setPairModalSourceId(it.draftId)}
                          />
                          {/* Manual line — render the lookup panel so the
                              pharmacist can ask other pharmacies + see
                              their responses. Catalog items skip this. */}
                          {!it.medicineId && it.manualMedicineName ? (
                            <ManualLookupPanel
                              prescriptionId={activeId!}
                              manualMedicineName={it.manualMedicineName}
                              lookupRequestId={it.lookupRequestId ?? null}
                              onRequestCreated={(reqId) =>
                                updateItem(activeId!, it.draftId, { lookupRequestId: reqId })
                              }
                            />
                          ) : null}
                        </li>
                      );
                    })}
                  </ul>
                );
              })()}
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

        <PairAnalogModal
          open={pairModalSourceId !== null}
          sourceItem={pairModalSourceId ? draft.items.find((i) => i.draftId === pairModalSourceId) ?? null : null}
          allItems={draft.items}
          medicineCache={medicineCache}
          onClose={() => setPairModalSourceId(null)}
          onPick={(analogDraftId) => {
            if (!activeId || !pairModalSourceId) return;
            // Pairing rules:
            //   • can't pair an item with itself
            //   • can't chain — the chosen analog cannot itself already be
            //     an "original" of another pair (analogDraftId would create
            //     a cycle the backend rejects in submitChecklistAsync).
            //   • re-pair: if the source already had an analog, the new pick
            //     replaces it; the former analog falls back to standalone.
            updateItem(activeId, pairModalSourceId, { analogDraftId });
            setPairModalSourceId(null);
          }}
        />

        <AuthedImageLightbox src={lightboxSrc} onClose={() => setLightboxSrc(null)} />
      </div>
    </PharmacistShell>
  );
}

/* ===================================================================
   DraftRow — one row inside the pharmacist's prescription cart. Three
   visual modes: "solo" (no pair), "original" (lower half of a pair —
   muted), "analog" (top half of a pair — accent ring + label). All
   modes share the qty stepper, comment toggle and remove button; the
   pair-trigger button is hidden inside paired rows (the pair header
   carries the "разъединить" affordance instead).
   =================================================================== */
function DraftRow({
  it,
  role,
  activeId,
  medicineCache,
  onUpdate,
  onRemove,
  onToggleComment,
  isCommentOpen,
  onPair,
}: {
  it: DraftItem;
  role: "solo" | "original" | "analog";
  activeId: string;
  medicineCache: Record<string, ApiMedicine>;
  onUpdate: (prescriptionId: string, draftId: string, patch: Partial<DraftItem>) => void;
  onRemove: (prescriptionId: string, draftId: string) => void;
  onToggleComment: (draftId: string) => void;
  isCommentOpen: boolean;
  onPair: () => void;
}) {
  const med = it.medicineId ? medicineCache[it.medicineId] : undefined;
  const imgUrl = med ? resolveMedicineImageUrl(med, 240) : "";
  const title = med ? getMedicineDisplayName(med) : it.displayTitle;
  const wrapperClass =
    role === "analog"
      ? "rounded-2xl bg-surface-container-lowest p-3 ring-2 ring-primary"
      : role === "original"
      ? "rounded-2xl bg-surface-container-lowest/80 p-3 opacity-90"
      : "";
  return (
    <div className={wrapperClass}>
      {role === "analog" ? (
        <p className="mb-1 text-[10px] font-extrabold uppercase tracking-wider text-primary">
          Аналог
        </p>
      ) : role === "original" ? (
        <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">
          Оригинал
        </p>
      ) : null}
      <div className="flex items-center gap-3">
        <div className="h-12 w-12 flex-shrink-0 overflow-hidden rounded-xl bg-image-backdrop xs:h-14 xs:w-14">
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
            {it.useUnitMode ? (
              <span className="ml-2 rounded-full bg-accent-sun/30 px-2 py-0.5 text-[10px] font-bold text-accent-sun-ink">
                Поштучно
              </span>
            ) : null}
          </p>
          {it.pharmacistComment ? (
            <p className="mt-0.5 line-clamp-2 text-[11px] text-on-surface-variant">{it.pharmacistComment}</p>
          ) : null}
        </div>

        {/* Qty stepper — represents PACKAGES even in unit-mode (used
            for stock-availability check). Unit count + total price live
            in the dedicated panel below when useUnitMode is on. */}
        <div
          className="flex flex-shrink-0 items-center gap-0.5 rounded-full bg-surface-container-low p-0.5"
          title={it.useUnitMode ? "Минимальное число пачек, нужно для покрытия заявки" : "Кол-во пачек"}
        >
          <button
            type="button"
            onClick={() => onUpdate(activeId, it.draftId, { quantity: Math.max(1, it.quantity - 1) })}
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
            onClick={() => onUpdate(activeId, it.draftId, { quantity: it.quantity + 1 })}
            className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-white transition hover:bg-primary-container active:scale-95"
            aria-label="Больше"
          >
            <Icon name="plus" size={14} />
          </button>
        </div>

        <button
          type="button"
          onClick={() => onToggleComment(it.draftId)}
          className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-on-surface-variant transition active:scale-95 hover:bg-image-backdrop"
          aria-label="Комментарий"
          title="Комментарий по позиции"
        >
          <Icon name="orders" size={14} />
        </button>

        <button
          type="button"
          onClick={() => onRemove(activeId, it.draftId)}
          className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-on-surface-variant transition active:scale-95 hover:bg-secondary-soft hover:text-secondary"
          aria-label="Удалить"
        >
          <Icon name="close" size={14} />
        </button>
      </div>

      {/* Kind toggle, pair trigger and unit-mode switch. Pair-trigger is
          only shown in solo mode (inside a pair, the kind is fixed
          Original and the header carries the unpair affordance). The
          unit-mode toggle is available on every Original-kind row,
          solo OR paired, since pricing applies independently per row. */}
      <div className="mt-2 flex flex-wrap items-center gap-2">
        {role === "solo" && (it.kind ?? "Original") === "Original" ? (
          <button
            type="button"
            onClick={onPair}
            className="rounded-full border border-dashed border-outline px-2.5 py-1 text-[11px] font-semibold text-on-surface-variant transition active:scale-95 hover:border-primary hover:text-primary"
          >
            + Привязать аналог
          </button>
        ) : null}
        {(it.kind ?? "Original") === "Original" ? (
          <button
            type="button"
            onClick={() => onUpdate(activeId, it.draftId, {
              useUnitMode: !it.useUnitMode,
              // Reset numeric fields when turning off so we don't ship
              // stale leftovers; keep them when turning on so the
              // pharmacist can resume editing.
              ...(it.useUnitMode
                ? { unitCount: null, unitTotalPrice: null }
                : {}),
            })}
            className={`rounded-full px-2.5 py-1 text-[11px] font-semibold transition ${
              it.useUnitMode
                ? "bg-accent-sun text-accent-sun-ink"
                : "border border-dashed border-outline text-on-surface-variant hover:border-primary hover:text-primary"
            }`}
          >
            {it.useUnitMode ? "✓ В единицах" : "В единицах"}
          </button>
        ) : null}
      </div>

      {it.useUnitMode ? (
        <div className="mt-2 grid grid-cols-2 gap-2 rounded-2xl bg-accent-sun/15 p-2">
          <label className="flex flex-col gap-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">
              Кол-во единиц
            </span>
            <input
              type="number"
              min={1}
              step={1}
              value={it.unitCount ?? ""}
              onChange={(e) => {
                const v = e.target.value;
                onUpdate(activeId, it.draftId, {
                  unitCount: v === "" ? null : Math.max(1, Math.floor(Number(v))),
                });
              }}
              placeholder="напр. 30"
              className="stitch-input text-sm"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">
              Сумма за всё, TJS
            </span>
            <input
              type="number"
              min={0}
              step="0.01"
              value={it.unitTotalPrice ?? ""}
              onChange={(e) => {
                const v = e.target.value;
                onUpdate(activeId, it.draftId, {
                  unitTotalPrice: v === "" ? null : Math.max(0, Number(v)),
                });
              }}
              placeholder="напр. 75.00"
              className="stitch-input text-sm"
            />
          </label>
          <p className="col-span-2 text-[10px] leading-tight text-on-surface-variant">
            Поштучный расчёт: цена позиции = сумма выше. Поле «пачек» сверху —
            это минимум пачек, нужный, чтобы собрать указанные единицы; по
            нему проверяется наличие на складе аптеки.
          </p>
        </div>
      ) : null}

      {isCommentOpen ? (
        <input
          type="text"
          placeholder="Как принимать, замены и т.п."
          value={it.pharmacistComment ?? ""}
          onChange={(e) => onUpdate(activeId, it.draftId, { pharmacistComment: e.target.value })}
          className="stitch-input mt-2 w-full text-xs"
        />
      ) : null}
    </div>
  );
}

/* ===================================================================
   PairAnalogModal — opens when the pharmacist clicks "Привязать аналог"
   on an Original-kind row. Lists the OTHER cart items as candidate
   analogs; one tap pairs them. Hides the source itself, items already
   paired as some other original's analog (would create cycles), and
   Undecoded rows (can't be analogs).
   =================================================================== */
function PairAnalogModal({
  open,
  sourceItem,
  allItems,
  medicineCache,
  onClose,
  onPick,
}: {
  open: boolean;
  sourceItem: DraftItem | null;
  allItems: DraftItem[];
  medicineCache: Record<string, ApiMedicine>;
  onClose: () => void;
  onPick: (analogDraftId: string) => void;
}) {
  // Existing pair links — needed both to highlight the source's current
  // analog (if any) and to filter out items that are already someone
  // else's analog (would create chains the backend rejects).
  const alreadyAnalogOfSomeoneElse = useMemo(() => {
    const taken = new Set<string>();
    for (const it of allItems) {
      if (sourceItem && it.draftId === sourceItem.draftId) continue;
      if (it.analogDraftId) taken.add(it.analogDraftId);
    }
    return taken;
  }, [allItems, sourceItem]);

  if (!open || !sourceItem) return null;

  const candidates = allItems.filter((it) => {
    if (it.draftId === sourceItem.draftId) return false;
    if ((it.kind ?? "Original") === "Undecoded") return false;
    if (alreadyAnalogOfSomeoneElse.has(it.draftId)) return false;
    // Avoid the chain: don't allow an item that ITSELF carries an analog
    // link to be chosen as someone else's analog.
    if (it.analogDraftId) return false;
    return true;
  });

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-3xl bg-surface p-4 shadow-float"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-display text-base font-extrabold">Выберите аналог из корзины</h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Закрыть"
            className="flex h-8 w-8 items-center justify-center rounded-full text-on-surface-variant hover:bg-image-backdrop"
          >
            <Icon name="close" size={16} />
          </button>
        </div>
        <p className="mb-3 line-clamp-2 text-xs text-on-surface-variant">
          Привязка к: <span className="font-bold text-on-surface">
            {sourceItem.medicineId ? (medicineCache[sourceItem.medicineId] ? getMedicineDisplayName(medicineCache[sourceItem.medicineId]) : sourceItem.displayTitle) : sourceItem.displayTitle}
          </span>
        </p>
        {candidates.length === 0 ? (
          <div className="rounded-2xl bg-surface-container-low p-4 text-center text-sm text-on-surface-variant">
            В корзине нет других позиций, которые можно сделать аналогом. Сначала добавьте препарат-замену в корзину.
          </div>
        ) : (
          <ul className="space-y-2 max-h-[60vh] overflow-y-auto">
            {candidates.map((c) => {
              const med = c.medicineId ? medicineCache[c.medicineId] : undefined;
              const imgUrl = med ? resolveMedicineImageUrl(med, 240) : "";
              const title = med ? getMedicineDisplayName(med) : c.displayTitle;
              const isCurrent = sourceItem.analogDraftId === c.draftId;
              return (
                <li key={c.draftId}>
                  <button
                    type="button"
                    onClick={() => onPick(c.draftId)}
                    className={`flex w-full items-center gap-3 rounded-2xl p-3 text-left transition active:scale-95 hover:bg-image-backdrop ${
                      isCurrent ? "ring-2 ring-primary bg-primary-soft" : "bg-surface-container-lowest"
                    }`}
                  >
                    <div className="h-12 w-12 flex-shrink-0 overflow-hidden rounded-xl bg-image-backdrop">
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
                      <p className="line-clamp-2 text-sm font-bold leading-tight">{title}</p>
                      <p className="mt-0.5 text-[11px] text-on-surface-variant">
                        Кол-во: {c.quantity}{!c.medicineId ? " · вне каталога" : ""}
                      </p>
                    </div>
                    {isCurrent ? (
                      <span className="text-[10px] font-extrabold uppercase tracking-wider text-primary">
                        Текущий
                      </span>
                    ) : null}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
