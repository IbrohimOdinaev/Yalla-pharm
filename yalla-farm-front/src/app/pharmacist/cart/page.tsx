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
import { useActivePrescriptionStore } from "@/features/pharmacist/model/activePrescriptionStore";
import { usePrescriptionDraftStore } from "@/features/pharmacist/model/prescriptionDraftStore";
import { PharmacistShell } from "@/widgets/layout/PharmacistShell";
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

  const [manualName, setManualName] = useState("");
  const [manualQty, setManualQty] = useState("1");
  const [manualComment, setManualComment] = useState("");

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

  // If the prescription has a server-side checklist (already Decoded) and the
  // local draft is empty, seed the draft from server so the pharmacist can
  // continue editing past work. Runs once when prescription / activeId
  // changes.
  useEffect(() => {
    if (!activeId || !prescription) return;
    const cur = drafts[activeId];
    if (cur && cur.items.length > 0) return;
    if (prescription.items.length === 0 && !prescription.pharmacistOverallComment) return;
    // Hydrate draft.
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

  const phone = useMemo(() => {
    const p = prescription?.clientPhoneNumber?.replace(/\D/g, "");
    return p ? `+992${p}` : null;
  }, [prescription]);

  function onAddManual() {
    if (!activeId) return;
    const name = manualName.trim();
    const qty = Number(manualQty);
    if (!name) return;
    if (!Number.isFinite(qty) || qty <= 0) return;
    addItem(activeId, {
      draftId: `man-${Date.now()}`,
      medicineId: null,
      manualMedicineName: name,
      quantity: qty,
      pharmacistComment: manualComment.trim() || null,
      displayTitle: name,
    });
    setManualName(""); setManualQty("1"); setManualComment("");
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
              <h2 className="font-display text-base font-extrabold">Корзина рецепта</h2>
              {draft.items.length === 0 ? (
                <div className="rounded-2xl bg-surface-container-low p-4 text-xs text-on-surface-variant">
                  Корзина пуста. Откройте «Каталог», чтобы добавить лекарства, или
                  введите препарат вручную ниже.
                </div>
              ) : (
                <ul className="space-y-2">
                  {draft.items.map((it) => (
                    <li key={it.draftId} className="rounded-2xl bg-surface-container-lowest p-3 shadow-card">
                      <div className="flex items-start gap-3">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-bold">
                            {it.displayTitle}
                            {!it.medicineId ? (
                              <span className="ml-2 rounded-full bg-warning-soft px-2 py-0.5 text-[10px] font-bold text-warning">
                                Нет в каталоге
                              </span>
                            ) : null}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeItem(activeId, it.draftId)}
                          className="flex h-7 w-7 items-center justify-center rounded-full text-on-surface-variant transition hover:bg-secondary-soft hover:text-secondary"
                          aria-label="Удалить"
                        >
                          <Icon name="close" size={14} />
                        </button>
                      </div>
                      <div className="mt-2 grid gap-2 sm:grid-cols-2">
                        <label className="block text-xs">
                          <span className="text-on-surface-variant">Количество</span>
                          <input
                            type="number"
                            min={1}
                            value={it.quantity}
                            onChange={(e) => updateItem(activeId, it.draftId, { quantity: Math.max(1, Number(e.target.value) || 1) })}
                            className="stitch-input mt-1 w-full"
                          />
                        </label>
                        <label className="block text-xs">
                          <span className="text-on-surface-variant">Комментарий</span>
                          <input
                            type="text"
                            value={it.pharmacistComment ?? ""}
                            onChange={(e) => updateItem(activeId, it.draftId, { pharmacistComment: e.target.value })}
                            className="stitch-input mt-1 w-full"
                          />
                        </label>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {/* Manual entry */}
            <section className="space-y-3 rounded-2xl bg-surface-container-low p-4">
              <h3 className="font-display text-sm font-extrabold">Препарат не из нашего каталога</h3>
              <div className="grid gap-2 sm:grid-cols-3">
                <input
                  type="text"
                  placeholder="Название"
                  value={manualName}
                  onChange={(e) => setManualName(e.target.value)}
                  className="stitch-input sm:col-span-2"
                />
                <input
                  type="number"
                  min={1}
                  placeholder="Кол-во"
                  value={manualQty}
                  onChange={(e) => setManualQty(e.target.value)}
                  className="stitch-input"
                />
              </div>
              <input
                type="text"
                placeholder="Комментарий (необязательно)"
                value={manualComment}
                onChange={(e) => setManualComment(e.target.value)}
                className="stitch-input w-full"
              />
              <button
                type="button"
                onClick={onAddManual}
                disabled={!manualName.trim()}
                className="rounded-full bg-primary px-5 py-2 text-sm font-bold text-white transition hover:bg-primary-container disabled:opacity-40"
              >
                Добавить вручную
              </button>
            </section>

            {/* Overall comment + submit */}
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
      </div>
    </PharmacistShell>
  );
}
