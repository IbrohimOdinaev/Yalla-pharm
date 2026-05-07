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
import { usePrescriptionDraftStore } from "@/features/pharmacist/model/prescriptionDraftStore";
import { PharmacistShell } from "@/widgets/layout/PharmacistShell";
import { ManualEntryModal } from "@/widgets/pharmacist/ManualEntryModal";
import { useAnalogTargetStore } from "@/features/pharmacist/model/analogTargetStore";
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

  // "Привязать аналог" → stash the target item in sessionStorage and hop
  // to /pharmacist/catalog. The next medicine the pharmacist taps the "+"
  // on becomes the analog for this line; both MedicineCard and the
  // product modal read the same store, attach the analog, and bounce
  // back here.
  const setAnalogTarget = useAnalogTargetStore((s) => s.setTarget);
  function startAnalogPick(draftId: string, sourceTitle: string, sourceMedicineId: string | null | undefined) {
    if (!activeId) return;
    setAnalogTarget({
      prescriptionId: activeId,
      draftId,
      sourceMedicineId: sourceMedicineId ?? "",
      sourceTitle,
    });
    router.push("/pharmacist/catalog");
  }
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
      .then(setPrescription)
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
  }, [token, role, activeId, setActiveId]);

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
      await submitChecklist(token, activeId, {
        overallComment: draft.overallComment.trim() || null,
        items: draft.items.map((i) => ({
          medicineId: i.medicineId ?? null,
          manualMedicineName: i.manualMedicineName ?? null,
          quantity: i.quantity,
          pharmacistComment: i.pharmacistComment ?? null,
          kind: i.kind === "Undecoded" ? 1 : 0,
          analogMedicineId: i.kind === "Undecoded" ? null : (i.analogMedicineId ?? null),
        })),
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
              ) : (
                <ul className="space-y-2">
                  {draft.items.map((it) => {
                    const med = it.medicineId ? medicineCache[it.medicineId] : undefined;
                    const imgUrl = med ? resolveMedicineImageUrl(med, 240) : "";
                    const title = med ? getMedicineDisplayName(med) : it.displayTitle;
                    const isCommentOpen = editingCommentFor === it.draftId;
                    return (
                      <li key={it.draftId} className="rounded-2xl bg-surface-container-lowest p-3 shadow-card">
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
                            className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-on-surface-variant transition hover:bg-image-backdrop"
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

                        {/* Kind toggle — pharmacist marks each line either as
                            an identified original medicine or as a row they
                            couldn't read. Required by the workflow: every
                            position MUST be one of the two. Default is
                            Original; the toggle makes Undecoded explicit. */}
                        <div className="mt-2 flex items-center gap-2">
                          <div className="flex items-center gap-1 rounded-full bg-surface-container-low p-0.5 text-[11px] font-semibold">
                            <button
                              type="button"
                              onClick={() => updateItem(activeId, it.draftId, { kind: "Original" })}
                              className={`rounded-full px-2.5 py-1 transition ${
                                (it.kind ?? "Original") === "Original"
                                  ? "bg-primary text-white shadow-card"
                                  : "text-on-surface-variant hover:text-on-surface"
                              }`}
                            >
                              Оригинал
                            </button>
                            <button
                              type="button"
                              onClick={() => updateItem(activeId, it.draftId, { kind: "Undecoded", analogMedicineId: null, analogTitle: null })}
                              className={`rounded-full px-2.5 py-1 transition ${
                                it.kind === "Undecoded"
                                  ? "bg-secondary text-white shadow-card"
                                  : "text-on-surface-variant hover:text-on-surface"
                              }`}
                            >
                              Не смог расшифровать
                            </button>
                          </div>
                          {/* Analog status — every Original-kind position can
                              carry a cheaper substitute. Shown for both
                              catalog and manual items: even if the original
                              isn't in our catalog the pharmacist can offer a
                              catalog analog the client can actually buy.
                              Click "Привязать аналог" → catalog search modal;
                              click the chip body to swap, X to clear. */}
                          {(it.kind ?? "Original") === "Original" ? (
                            it.analogMedicineId ? (
                              <span className="flex items-center gap-1 rounded-full bg-accent-mint px-2.5 py-1 text-[11px] font-bold text-accent-mint-ink">
                                <button
                                  type="button"
                                  onClick={() => startAnalogPick(it.draftId, title, it.medicineId)}
                                  className="hover:underline"
                                  title="Сменить аналог"
                                >
                                  Аналог: {it.analogTitle ?? "выбран"}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => updateItem(activeId, it.draftId, { analogMedicineId: null, analogTitle: null })}
                                  className="-mr-1 flex h-4 w-4 items-center justify-center rounded-full hover:bg-on-surface/10"
                                  aria-label="Убрать аналог"
                                >
                                  <Icon name="close" size={10} />
                                </button>
                              </span>
                            ) : (
                              <button
                                type="button"
                                onClick={() => startAnalogPick(it.draftId, title, it.medicineId)}
                                className="rounded-full border border-dashed border-outline px-2.5 py-1 text-[11px] font-semibold text-on-surface-variant transition hover:border-primary hover:text-primary"
                              >
                                + Привязать аналог
                              </button>
                            )
                          ) : null}
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

        <AuthedImageLightbox src={lightboxSrc} onClose={() => setLightboxSrc(null)} />
      </div>
    </PharmacistShell>
  );
}
