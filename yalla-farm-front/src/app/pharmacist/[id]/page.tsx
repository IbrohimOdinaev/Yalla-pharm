"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAppSelector } from "@/shared/lib/redux";
import {
  getPharmacistPrescription,
  takePrescriptionIntoReview,
  submitChecklist,
  type DecodePrescriptionItemInput,
} from "@/entities/pharmacist/api";
import { type ApiPrescription } from "@/entities/prescription/api";
import { getAllMedicines } from "@/entities/medicine/admin-api";
import { getMedicineDisplayName } from "@/entities/medicine/api";
import type { ApiMedicine } from "@/shared/types/api";
import { AppShell } from "@/widgets/layout/AppShell";
import { TopBar } from "@/widgets/layout/TopBar";
import { AuthedImage, Button, Icon } from "@/shared/ui";

type DraftItem = DecodePrescriptionItemInput & {
  /** Local id used only on the client for stable React keys / removal. */
  draftId: string;
  /** Display title — for catalog-bound items, fetched once at add-time; for manual items, equals manualMedicineName. */
  displayTitle: string;
};

export default function PharmacistDecodePage() {
  const params = useParams<{ id: string }>();
  const id = String(params?.id || "");
  const router = useRouter();

  const token = useAppSelector((s) => s.auth.token);
  const role = useAppSelector((s) => s.auth.role);
  const hydrated = useAppSelector((s) => s.auth.hydrated);

  const [prescription, setPrescription] = useState<ApiPrescription | null>(null);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState<string | null>(null);
  const [taking, setTaking] = useState(false);

  const [overallComment, setOverallComment] = useState("");
  const [items, setItems] = useState<DraftItem[]>([]);

  // Catalog search
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<ApiMedicine[]>([]);
  const [searching, setSearching] = useState(false);

  // Manual-entry form
  const [manualName, setManualName] = useState("");
  const [manualQty, setManualQty] = useState<string>("1");
  const [manualComment, setManualComment] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  /* ── Auth gate ── */
  useEffect(() => {
    if (!hydrated) return;
    if (!token) { router.replace("/login?next=/pharmacist"); return; }
    if (role && role !== "Pharmacist") router.replace("/");
  }, [hydrated, token, role, router]);

  /* ── Load prescription ── */
  const load = useCallback(() => {
    if (!token || role !== "Pharmacist") return;
    setLoading(true);
    setPageError(null);
    return getPharmacistPrescription(token, id)
      .then((data) => {
        setPrescription(data);
        if (data.pharmacistOverallComment) setOverallComment(data.pharmacistOverallComment);
      })
      .catch((err) => setPageError(err instanceof Error ? err.message : "Не удалось загрузить рецепт."))
      .finally(() => setLoading(false));
  }, [token, role, id]);

  useEffect(() => { load(); }, [load]);

  /* ── Take into review ── */
  async function onTake() {
    if (!token) return;
    setTaking(true);
    try {
      const updated = await takePrescriptionIntoReview(token, id);
      setPrescription(updated);
    } catch (err) {
      setPageError(err instanceof Error ? err.message : "Не удалось взять в работу.");
    } finally {
      setTaking(false);
    }
  }

  /* ── Catalog search (debounced) ── */
  useEffect(() => {
    if (!token || role !== "Pharmacist") return;
    if (!searchQuery.trim()) { setSearchResults([]); return; }
    const handle = setTimeout(async () => {
      setSearching(true);
      try {
        const data = await getAllMedicines(token, searchQuery, 1, 20);
        setSearchResults(data.medicines);
      } catch {
        setSearchResults([]);
      } finally {
        setSearching(false);
      }
    }, 250);
    return () => clearTimeout(handle);
  }, [token, role, searchQuery]);

  /* ── Item draft helpers ── */
  function addCatalogItem(med: ApiMedicine) {
    const draft: DraftItem = {
      draftId: `cat-${med.id}-${Date.now()}`,
      medicineId: med.id,
      manualMedicineName: null,
      quantity: 1,
      pharmacistComment: "",
      displayTitle: getMedicineDisplayName(med),
    };
    setItems((prev) => [...prev, draft]);
    setSearchQuery("");
    setSearchResults([]);
  }

  function addManualItem() {
    const name = manualName.trim();
    const qty = Number(manualQty);
    if (!name) return;
    if (!Number.isFinite(qty) || qty <= 0) return;
    const draft: DraftItem = {
      draftId: `man-${Date.now()}`,
      medicineId: null,
      manualMedicineName: name,
      quantity: qty,
      pharmacistComment: manualComment.trim() || null,
      displayTitle: name,
    };
    setItems((prev) => [...prev, draft]);
    setManualName(""); setManualQty("1"); setManualComment("");
  }

  function updateItem(draftId: string, patch: Partial<DraftItem>) {
    setItems((prev) => prev.map((i) => (i.draftId === draftId ? { ...i, ...patch } : i)));
  }

  function removeItem(draftId: string) {
    setItems((prev) => prev.filter((i) => i.draftId !== draftId));
  }

  /* ── Submit checklist ── */
  async function onSubmit() {
    if (!token) return;
    if (items.length === 0) {
      setSubmitError("Добавьте хотя бы одну позицию.");
      return;
    }
    setSubmitError(null);
    setSubmitting(true);
    try {
      const payload = {
        overallComment: overallComment.trim() || null,
        items: items.map((i) => ({
          medicineId: i.medicineId ?? null,
          manualMedicineName: i.manualMedicineName ?? null,
          quantity: i.quantity,
          pharmacistComment: i.pharmacistComment ?? null,
        })),
      };
      const updated = await submitChecklist(token, id, payload);
      setPrescription(updated);
      // After decode, jump back to queue.
      router.replace("/pharmacist");
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Не удалось отправить чек-лист.");
    } finally {
      setSubmitting(false);
    }
  }

  const status = prescription?.status;
  const isInQueue = status === "InQueue";
  const isInReview = status === "InReview";
  const isDone = status === "Decoded" || status === "OrderPlaced" || status === "MovedToCart";
  const canEdit = isInReview;

  const photos = useMemo(() => prescription?.images ?? [], [prescription]);

  return (
    <AppShell hideGlobalNav top={<TopBar title="Расшифровка рецепта" backHref="/pharmacist" />}>
      <div className="mx-auto max-w-3xl space-y-4 pb-24">
        {pageError ? (
          <div className="rounded-2xl bg-secondary/10 p-3 text-sm font-semibold text-secondary">{pageError}</div>
        ) : null}

        {loading ? (
          <div className="rounded-2xl bg-surface-container-low p-6 text-sm text-on-surface-variant">Загружаем…</div>
        ) : !prescription ? (
          <div className="rounded-2xl bg-surface-container-low p-6 text-sm text-on-surface-variant">
            Рецепт не найден.
          </div>
        ) : (
          <>
            {/* Photos + meta */}
            <section className="space-y-3 rounded-2xl bg-surface-container-lowest p-4 shadow-card">
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="rounded-full bg-primary-soft px-2 py-1 font-bold text-primary">{status}</span>
                <span className="text-on-surface-variant">
                  Возраст пациента: <span className="font-bold text-on-surface">{prescription.patientAge}</span>
                </span>
                <span className="text-on-surface-variant">
                  {new Date(prescription.createdAtUtc).toLocaleString("ru-RU")}
                </span>
              </div>
              {prescription.clientComment ? (
                <p className="text-sm">
                  <span className="font-semibold text-on-surface-variant">Клиент: </span>
                  {prescription.clientComment}
                </p>
              ) : null}
              <div className="grid grid-cols-2 gap-3">
                {photos.map((img) => (
                  <div key={img.id} className="relative aspect-[3/4] overflow-hidden rounded-2xl bg-surface-container">
                    <AuthedImage src={img.url} alt="" className="h-full w-full object-cover" />
                  </div>
                ))}
              </div>
            </section>

            {/* CTA depending on status */}
            {isInQueue ? (
              <Button size="lg" fullWidth loading={taking} onClick={onTake}>
                Взять в работу
              </Button>
            ) : null}

            {isDone ? (
              <div className="rounded-2xl bg-primary-soft p-4 text-sm text-on-surface">
                Чек-лист отправлен клиенту. Дальнейшие шаги — на стороне клиента.
              </div>
            ) : null}

            {canEdit ? (
              <>
                {/* Active basket: composed items */}
                <section className="space-y-3">
                  <h2 className="font-display text-base font-extrabold">Чек-лист для клиента</h2>
                  {items.length === 0 ? (
                    <div className="rounded-2xl bg-surface-container-low p-4 text-xs text-on-surface-variant">
                      Корзина пуста. Найдите лекарство в каталоге или добавьте вручную.
                    </div>
                  ) : (
                    <ul className="space-y-2">
                      {items.map((it) => (
                        <li key={it.draftId} className="rounded-2xl bg-surface-container-lowest p-3 shadow-card">
                          <div className="flex items-start gap-3">
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-bold">
                                {it.displayTitle}
                                {it.medicineId ? null : (
                                  <span className="ml-2 rounded-full bg-warning-soft px-2 py-0.5 text-[10px] font-bold text-warning">
                                    Нет в каталоге
                                  </span>
                                )}
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={() => removeItem(it.draftId)}
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
                                onChange={(e) => updateItem(it.draftId, { quantity: Math.max(1, Number(e.target.value) || 1) })}
                                className="stitch-input mt-1 w-full"
                              />
                            </label>
                            <label className="block text-xs">
                              <span className="text-on-surface-variant">Комментарий по позиции</span>
                              <input
                                type="text"
                                value={it.pharmacistComment ?? ""}
                                onChange={(e) => updateItem(it.draftId, { pharmacistComment: e.target.value })}
                                placeholder="Например: после еды по 1 шт"
                                className="stitch-input mt-1 w-full"
                              />
                            </label>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>

                {/* Catalog search */}
                <section className="space-y-3 rounded-2xl bg-surface-container-low p-4">
                  <h3 className="font-display text-sm font-extrabold">Найти лекарство в каталоге</h3>
                  <input
                    type="search"
                    placeholder="Название или артикул"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="stitch-input w-full"
                  />
                  {searching ? (
                    <p className="text-xs text-on-surface-variant">Ищу…</p>
                  ) : null}
                  {searchResults.length > 0 ? (
                    <ul className="max-h-64 space-y-1 overflow-y-auto">
                      {searchResults.map((m) => {
                        const offers = m.offers?.length ?? 0;
                        return (
                          <li key={m.id}>
                            <button
                              type="button"
                              onClick={() => addCatalogItem(m)}
                              className="flex w-full items-center gap-3 rounded-xl bg-surface-container-lowest p-2 text-left transition hover:bg-surface-container-high"
                            >
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-sm font-bold">{getMedicineDisplayName(m)}</p>
                                <p className="text-[11px] text-on-surface-variant">
                                  Артикул: {m.articul ?? "—"} · Офферов: {offers}
                                </p>
                              </div>
                              <span className="rounded-full bg-primary px-3 py-1 text-xs font-bold text-white">
                                Добавить
                              </span>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  ) : null}
                </section>

                {/* Manual entry */}
                <section className="space-y-3 rounded-2xl bg-surface-container-low p-4">
                  <h3 className="font-display text-sm font-extrabold">Препарат не из нашего каталога</h3>
                  <p className="text-xs text-on-surface-variant">
                    Если в каталоге нет нужного препарата — добавьте его вручную. Клиент увидит пометку «Нет в каталоге»
                    и красный индикатор отсутствия офферов.
                  </p>
                  <div className="grid gap-2 sm:grid-cols-3">
                    <input
                      type="text"
                      placeholder="Название препарата"
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
                    onClick={addManualItem}
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
                    value={overallComment}
                    onChange={(e) => setOverallComment(e.target.value)}
                    rows={4}
                    maxLength={2000}
                    placeholder="Напишите общие рекомендации по применению, возможные замены и т.п."
                    className="w-full rounded-2xl border border-outline bg-surface-container-lowest p-3 text-sm placeholder:text-on-surface-variant/60 focus:border-primary focus:outline-none"
                  />
                </section>

                {submitError ? (
                  <div className="rounded-2xl bg-secondary/10 p-3 text-sm font-semibold text-secondary">{submitError}</div>
                ) : null}

                <Button size="lg" fullWidth loading={submitting} onClick={onSubmit}>
                  Отправить чек-лист клиенту
                </Button>
              </>
            ) : null}
          </>
        )}
      </div>
    </AppShell>
  );
}
