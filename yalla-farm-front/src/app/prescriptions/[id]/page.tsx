"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useAppSelector } from "@/shared/lib/redux";
import {
  getMyPrescriptions,
  moveChecklistToCart,
  resubmitPrescription,
  PRESCRIPTION_STATUS_LABEL_RU,
  PRESCRIPTION_TIER_LABEL_RU,
  type ApiPrescription,
} from "@/entities/prescription/api";
import { getMedicinesByIds, getMedicineDisplayName, getCheapestPrice, resolveMedicineImageUrl } from "@/entities/medicine/api";
import type { ApiMedicine } from "@/shared/types/api";
import { formatMoney } from "@/shared/lib/format";
import { AppShell } from "@/widgets/layout/AppShell";
import { TopBar } from "@/widgets/layout/TopBar";
import { PrescriptionPharmacyPicker } from "@/widgets/prescription/PrescriptionPharmacyPicker";
import { AuthedImageLightbox } from "@/widgets/prescription/AuthedImageLightbox";
import { AuthedImage, Button, Chip, Icon } from "@/shared/ui";

export default function PrescriptionDetailPage() {
  const params = useParams<{ id: string }>();
  const id = String(params?.id || "");
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = useAppSelector((s) => s.auth.token);
  const role = useAppSelector((s) => s.auth.role);
  const hydrated = useAppSelector((s) => s.auth.hydrated);

  const [all, setAll] = useState<ApiPrescription[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [moving, setMoving] = useState<"order" | "cart" | null>(null);
  const [resubmitting, setResubmitting] = useState(false);
  const [medicineCache, setMedicineCache] = useState<Record<string, ApiMedicine>>({});
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);
  // Client-edited per-item quantities. Keyed by `PrescriptionChecklistItem.id`.
  // Persisted to localStorage so the edits survive tab close / browser
  // restart (sessionStorage was per-tab, which surprised clients who
  // returned later expecting their checklist cart). /cart/pharmacy reads
  // the same key when entering prescription mode, and `moveChecklistToCart`
  // posts the same map as `quantityOverrides` to the backend so "В корзину"
  // respects the client's edits too.
  const [editedQty, setEditedQty] = useState<Record<string, number>>({});
  // Pair selections: key = original (pair-anchor) item id, value = chosen
  // side's item id (either the original itself or its analog). Default
  // when missing = analog. Persisted alongside qty overrides so the
  // client's choice survives reload + tab close.
  const [pairSelections, setPairSelections] = useState<Record<string, string>>({});
  const overridesStorageKey = `yalla.prescription.qty.${id}`;
  const pairStorageKey = `yalla.prescription.pair.${id}`;
  useEffect(() => {
    if (typeof window === "undefined" || !id) return;
    try {
      // Migrate legacy sessionStorage rows from older builds — read once,
      // upgrade to localStorage, then drop the session copy. Idempotent on
      // subsequent loads.
      const legacy = sessionStorage.getItem(overridesStorageKey);
      if (legacy) {
        localStorage.setItem(overridesStorageKey, legacy);
        sessionStorage.removeItem(overridesStorageKey);
      }
      const raw = localStorage.getItem(overridesStorageKey);
      if (raw) setEditedQty(JSON.parse(raw));
      const rawPair = localStorage.getItem(pairStorageKey);
      if (rawPair) setPairSelections(JSON.parse(rawPair));
    } catch { /* ignore */ }
  }, [id, overridesStorageKey, pairStorageKey]);
  function persistEditedQty(next: Record<string, number>) {
    setEditedQty(next);
    if (typeof window === "undefined") return;
    try {
      if (Object.keys(next).length === 0) localStorage.removeItem(overridesStorageKey);
      else localStorage.setItem(overridesStorageKey, JSON.stringify(next));
    } catch { /* ignore */ }
  }
  function persistPairSelections(next: Record<string, string>) {
    setPairSelections(next);
    if (typeof window === "undefined") return;
    try {
      if (Object.keys(next).length === 0) localStorage.removeItem(pairStorageKey);
      else localStorage.setItem(pairStorageKey, JSON.stringify(next));
    } catch { /* ignore */ }
  }
  function setPairChoice(originalId: string, chosenId: string) {
    persistPairSelections({ ...pairSelections, [originalId]: chosenId });
  }
  // Effective quantity = client override (including 0 = "removed") OR the
  // pharmacist's recommendation. Note: 0 is a valid override — the item is
  // intentionally excluded from the order. We use `in` to differentiate
  // "no override" from "override == 0".
  function getEffectiveQty(itemId: string, recommended: number): number {
    return itemId in editedQty ? editedQty[itemId] : recommended;
  }
  function setItemQty(itemId: string, recommended: number, qty: number) {
    const clamped = Math.max(0, qty);
    const next = { ...editedQty };
    if (clamped === recommended) delete next[itemId];
    else next[itemId] = clamped;
    persistEditedQty(next);
  }

  useEffect(() => {
    if (!hydrated) return;
    if (!token) { router.replace("/login?next=/prescriptions"); return; }
    if (role && role !== "Client") router.replace("/");
  }, [hydrated, token, role, router]);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    getMyPrescriptions(token)
      .then((data) => { if (!cancelled) setAll(data); })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Не удалось загрузить рецепт.");
      });
    return () => { cancelled = true; };
  }, [token]);

  const prescription = useMemo(
    () => all?.find((p) => p.prescriptionId === id) ?? null,
    [all, id]
  );

  // Pull medicine details for every catalog-bound item via a single batch
  // round-trip. Previously N parallel GETs added perceptible latency even
  // with `Promise.all` because each request still paid its own RTT.
  useEffect(() => {
    if (!prescription) return;
    const ids = prescription.items
      .map((i) => i.medicineId)
      .filter((m): m is string => !!m && !medicineCache[m]);
    if (ids.length === 0) return;
    let cancelled = false;
    getMedicinesByIds(ids)
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
  }, [prescription?.prescriptionId, prescription?.items.length]);

  // Pair-aware totals: for every paired original we count only the chosen
  // side (analog by default). A pair where neither side has offers and no
  // valid qty contributes nothing. Singletons behave as before.
  const checklistTotals = useMemo(() => {
    if (!prescription) return { available: 0, unavailable: 0, manual: 0, totalCost: 0 };

    const itemsById = new Map(prescription.items.map((i) => [i.id, i]));
    const analogIds = new Set(
      prescription.items.filter((i) => i.analogItemId).map((i) => i.analogItemId as string),
    );

    function eligibility(it: ApiPrescription["items"][number]) {
      const med = it.medicineId ? medicineCache[it.medicineId] : undefined;
      const offerCount = med?.offers?.length ?? 0;
      const price = getCheapestPrice(med ?? undefined);
      const effectiveQty = it.id in editedQty ? editedQty[it.id] : it.quantity;
      const isManual = !it.medicineId;
      // Manual lines that gathered at least one pharmacy response have
      // temp shadow offers — treat them as orderable just like catalog
      // items, using the lookup's min price for the totals row.
      const tempCount = it.temporaryOfferCount ?? 0;
      const tempPrice = it.temporaryOfferMinPrice ?? null;
      const hasTempOffers = isManual && !!it.lookupRequestId && tempCount > 0 && tempPrice != null;
      const hasOffers = (!isManual && offerCount > 0 && !!price) || hasTempOffers;
      const effectivePrice = hasTempOffers ? (tempPrice ?? 0) : (price ?? 0);
      return {
        isManual,
        hasOffers,
        effectiveQty,
        price: effectivePrice,
      };
    }

    let available = 0, unavailable = 0, manual = 0, totalCost = 0;
    for (const it of prescription.items) {
      if (analogIds.has(it.id)) continue; // counted via its pair-original

      // For paired items, walk to the chosen side (or default = analog).
      let chosen = it;
      if (it.analogItemId) {
        const analog = itemsById.get(it.analogItemId);
        if (analog) {
          const pickedId = pairSelections[it.id];
          const preferAnalog = pickedId !== it.id;
          const chosenCandidate = preferAnalog ? analog : it;
          const otherCandidate = preferAnalog ? it : analog;
          const ec = eligibility(chosenCandidate);
          if (ec.hasOffers && ec.effectiveQty > 0) {
            chosen = chosenCandidate;
          } else {
            const eo = eligibility(otherCandidate);
            if (eo.hasOffers && eo.effectiveQty > 0) {
              chosen = otherCandidate;
            } else {
              if (ec.isManual && eo.isManual) manual++;
              else unavailable++;
              continue;
            }
          }
        }
      }

      const e = eligibility(chosen);
      if (e.effectiveQty <= 0) continue;
      // hasOffers is true for both catalog items and manual lookup
      // items with at least one pharmacy response — treat them
      // identically for the order totals.
      if (e.hasOffers) {
        available++;
        totalCost += e.price * e.effectiveQty;
      } else if (e.isManual) {
        manual++;
      } else {
        unavailable++;
      }
    }
    return { available, unavailable, manual, totalCost };
  }, [prescription, medicineCache, editedQty, pairSelections]);

  // Build a stable "open product modal" callback per item — pushes
  // ?product=<slug-or-id> which the global ProductModal listens to. We
  // prefer slug (SEO-friendly URL) and fall back to id when the cached
  // medicine row has no slug yet (e.g. brand-new product before backfill).
  function openDetailsFor(it: ApiPrescription["items"][number]): (() => void) | undefined {
    if (!it.medicineId) return undefined;
    const med = medicineCache[it.medicineId];
    const target = med?.slug || it.medicineId;
    return () => {
      const params = new URLSearchParams(searchParams.toString());
      params.set("product", target);
      router.push(`?${params.toString()}`, { scroll: false });
    };
  }

  // "Оформить заказ" — direct prescription-checkout flow. The prescription's
  // items go straight into pharmacy selection without ever touching the
  // client's regular basket. Backend computes pharmacy options from the
  // explicit positions we pass; final checkout uses Source.Kind=Explicit so
  // basket positions are left alone, AND Source.PrescriptionId so the
  // prescription is advanced Decoded → OrderPlaced atomically with the order.
  function handleOrderFromPrescription() {
    if (!prescription) return;
    setError(null);
    if (checklistTotals.available === 0) {
      setError("Нечего оформлять — у позиций нет офферов.");
      return;
    }
    router.push(`/cart/pharmacy?prescription=${encodeURIComponent(prescription.prescriptionId)}`);
  }

  // "В корзину" — explicit move-to-basket, the legacy flow. Keeps the user's
  // basket as the staging area for any further edits before ordering. Passes
  // the client-edited quantities along so the basket picks up exactly the
  // counts the user picked on this screen.
  async function handleMoveToCart() {
    if (!token || !prescription) return;
    setMoving("cart");
    setError(null);
    try {
      const result = await moveChecklistToCart(
        token,
        prescription.prescriptionId,
        { quantityOverrides: editedQty, pairSelections },
      );
      if (result.movedItemsCount === 0) {
        setError("Нечего перемещать — у позиций нет офферов.");
        return;
      }
      router.push("/cart");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось выполнить действие.");
    } finally {
      setMoving(null);
    }
  }

  return (
    <AppShell top={<TopBar title="Рецепт" backHref="back" />}>
      <div className="mx-auto max-w-3xl space-y-4">
        {error ? (
          <div className="rounded-2xl bg-secondary/10 p-3 text-sm font-semibold text-secondary">
            {error}
          </div>
        ) : null}

        {!all ? (
          <div className="rounded-2xl bg-surface-container-low p-6 text-sm text-on-surface-variant">
            Загружаем…
          </div>
        ) : !prescription ? (
          <div className="rounded-2xl bg-surface-container-low p-6 text-sm text-on-surface-variant">
            Рецепт не найден.
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <Chip tone="tertiary" asButton={false} size="sm">
                {PRESCRIPTION_STATUS_LABEL_RU[prescription.status] ?? prescription.status}
              </Chip>
              {prescription.preferenceTier ? (
                <Chip tone="primary" asButton={false} size="sm">
                  {PRESCRIPTION_TIER_LABEL_RU[prescription.preferenceTier]}
                </Chip>
              ) : null}
              <span className="text-xs text-on-surface-variant">
                {new Date(prescription.createdAtUtc).toLocaleString("ru-RU")}
              </span>
            </div>

            {/* Submitted = uploaded but not paid. We no longer ask the client
                to confirm — instead we surface the DC payment link and let
                the backend's 24h timeout job auto-cancel anything that goes
                unpaid. Once paid, the webhook flips the status; the
                SignalR-driven UI updates this page automatically. */}
            {prescription.status === "Submitted" ? (
              <section className="space-y-3 rounded-2xl bg-accent-soft p-4">
                <p className="text-sm font-bold text-on-surface">Ожидаем оплату 3 TJS</p>
                <p className="text-xs text-on-surface-variant">
                  Откройте ссылку ниже и оплатите расшифровку. Как только платёж придёт, заявка автоматически отправится фармацевту.
                </p>
                {prescription.paymentUrl ? (
                  <a
                    href={prescription.paymentUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-bold text-white shadow-card transition hover:bg-primary-container"
                  >
                    <Icon name="bolt" size={14} />
                    Оплатить 3 TJS
                  </a>
                ) : (
                  <p className="text-xs text-secondary">
                    Не удалось получить платёжную ссылку. Обновите страницу или попробуйте позже.
                  </p>
                )}
                <p className="text-[11px] text-on-surface-variant/80">
                  Если оплата не поступит в течение 24 часов, заявка будет автоматически отменена.
                </p>
              </section>
            ) : null}

            {/* Cancelled status — either the user cancelled or the 24h timeout
                fired. Offer a one-click resubmit that clones the photos /
                age / comment into a new Submitted prescription with a fresh
                payment URL. Original record stays in history. */}
            {prescription.status === "Cancelled" ? (
              <section className="space-y-3 rounded-2xl bg-secondary/10 p-4">
                <p className="text-sm font-bold text-secondary">Рецепт отменён</p>
                <p className="text-xs text-on-surface-variant">
                  Вы можете переотправить тот же рецепт. Создастся новая заявка с теми же фото и данными — нужно будет снова оплатить 3 TJS.
                </p>
                <Button
                  size="md"
                  loading={resubmitting}
                  onClick={async () => {
                    if (!token) return;
                    setResubmitting(true);
                    setError(null);
                    try {
                      const created = await resubmitPrescription(token, id);
                      // Hop to the new prescription detail (with fresh paymentUrl
                      // from the backend response) so the user lands on the live
                      // unpaid state instead of the cancelled-history view.
                      if (created.paymentUrl) {
                        window.location.href = created.paymentUrl;
                        return;
                      }
                      router.push(`/prescriptions/${created.prescriptionId}`);
                    } catch (err) {
                      setError(err instanceof Error ? err.message : "Не удалось переотправить рецепт.");
                    } finally {
                      setResubmitting(false);
                    }
                  }}
                >
                  Переотправить рецепт
                </Button>
              </section>
            ) : null}

            <section className="space-y-2">
              <h2 className="font-display text-base font-extrabold">Фото</h2>
              <div className="grid grid-cols-2 gap-3">
                {prescription.images.map((img) => (
                  <button
                    key={img.id}
                    type="button"
                    onClick={() => setLightboxSrc(img.url)}
                    className="relative aspect-[3/4] overflow-hidden rounded-2xl bg-image-backdrop shadow-card transition hover:opacity-90 active:scale-[0.99]"
                    aria-label="Открыть фото на весь экран"
                  >
                    <AuthedImage
                      src={img.url}
                      alt=""
                      className="h-full w-full object-cover"
                      fallback={
                        <div className="flex h-full w-full items-center justify-center">
                          <div className="h-8 w-8 animate-spin rounded-full border-2 border-on-surface-variant/20 border-t-on-surface-variant/70" />
                        </div>
                      }
                    />
                  </button>
                ))}
              </div>
            </section>

            <section className="space-y-2 rounded-2xl bg-surface-container-lowest p-4 shadow-card">
              <p className="text-sm">
                <span className="font-semibold text-on-surface-variant">Возраст пациента: </span>
                <span className="font-bold">{prescription.patientAge}</span>
              </p>
              {prescription.clientComment ? (
                <p className="text-sm">
                  <span className="font-semibold text-on-surface-variant">Комментарий: </span>
                  <span>{prescription.clientComment}</span>
                </p>
              ) : null}
            </section>

            {prescription.pharmacistOverallComment ? (
              <section className="rounded-2xl bg-primary-soft p-4">
                <p className="text-xs font-bold uppercase tracking-wider text-primary">Фармацевт</p>
                <p className="mt-1 text-sm text-on-surface">{prescription.pharmacistOverallComment}</p>
              </section>
            ) : null}

            {prescription.items.length > 0 ? (
              <section className="space-y-3">
                <div className="flex items-end justify-between gap-3">
                  <h2 className="font-display text-base font-extrabold">Назначение</h2>
                  {checklistTotals.available > 0 ? (
                    <p className="text-sm font-bold text-primary">
                      от {formatMoney(checklistTotals.totalCost)}
                    </p>
                  ) : null}
                </div>

                <ul className="space-y-2">
                  {(() => {
                    // Same pair-folding logic as the pharmacist cart: hide
                    // items that are some other row's analog from the flat
                    // list — they render INSIDE the pair's combined block.
                    const itemsById = new Map(prescription.items.map((i) => [i.id, i]));
                    const analogIds = new Set(
                      prescription.items.filter((i) => i.analogItemId).map((i) => i.analogItemId as string),
                    );
                    return prescription.items.map((it) => {
                      if (analogIds.has(it.id)) return null;
                      const analog = it.analogItemId ? itemsById.get(it.analogItemId) ?? null : null;
                      if (analog) {
                        const editable = prescription.status === "Decoded";
                        const selectedId = pairSelections[it.id] ?? analog.id;
                        return (
                          <li
                            key={it.id}
                            className="rounded-2xl border-2 border-primary/40 bg-primary-soft p-2 shadow-card"
                          >
                            <p className="mb-1 px-2 pt-1 text-[10px] font-extrabold uppercase tracking-wider text-primary">
                              Пара (аналог рекомендуется)
                            </p>
                            <PairSideRow
                              role="analog"
                              item={analog}
                              isSelected={selectedId === analog.id}
                              editable={editable}
                              medicineCache={medicineCache}
                              getEffectiveQty={getEffectiveQty}
                              onSelect={editable ? () => setPairChoice(it.id, analog.id) : undefined}
                              onSetQty={(qty) => setItemQty(analog.id, analog.quantity, qty)}
                              onOpenDetails={openDetailsFor(analog)}
                            />
                            <div className="mx-2 my-1 h-px bg-primary/30" />
                            <PairSideRow
                              role="original"
                              item={it}
                              isSelected={selectedId === it.id}
                              editable={editable}
                              medicineCache={medicineCache}
                              getEffectiveQty={getEffectiveQty}
                              onSelect={editable ? () => setPairChoice(it.id, it.id) : undefined}
                              onSetQty={(qty) => setItemQty(it.id, it.quantity, qty)}
                              onOpenDetails={openDetailsFor(it)}
                            />
                          </li>
                        );
                      }
                      // Singleton — flat row layout with the same comment +
                      // details affordances as a pair side. Extracted to a
                      // component so commentOpen state is per-row.
                      return (
                        <SingletonRow
                          key={it.id}
                          item={it}
                          editable={prescription.status === "Decoded"}
                          medicineCache={medicineCache}
                          getEffectiveQty={getEffectiveQty}
                          onSetQty={(qty) => setItemQty(it.id, it.quantity, qty)}
                          onOpenDetails={openDetailsFor(it)}
                        />
                      );
                    });
                  })()}
                </ul>

                {prescription.status === "Decoded" ? (
                  <>
                    {/* Pharmacy picker covers both catalog items AND manual
                        items that other pharmacies offered through the
                        lookup workflow. Render alongside the legacy
                        order/cart CTAs — picker writes the checkout draft
                        directly, the buttons go through the
                        cart-pharmacy/cart fallbacks. */}
                    <div className="space-y-2">
                      <h3 className="font-display text-sm font-extrabold">Выбрать аптеку для оформления</h3>
                      <PrescriptionPharmacyPicker prescriptionId={prescription.prescriptionId} />
                    </div>

                    <div className="flex flex-col gap-2 sm:flex-row">
                      <Button
                        size="lg"
                        fullWidth
                        onClick={handleOrderFromPrescription}
                        disabled={checklistTotals.available === 0}
                      >
                        Оформить заказ
                      </Button>
                      <Button
                        size="lg"
                        variant="secondary"
                        fullWidth
                        loading={moving === "cart"}
                        onClick={handleMoveToCart}
                        disabled={checklistTotals.available === 0}
                      >
                        В корзину
                      </Button>
                    </div>
                  </>
                ) : null}

                {prescription.status === "Decoded" && checklistTotals.unavailable + checklistTotals.manual > 0 ? (
                  <p className="text-[11px] text-on-surface-variant">
                    {checklistTotals.unavailable + checklistTotals.manual} {(checklistTotals.unavailable + checklistTotals.manual) === 1 ? "позиция" : "позиции"} не уйдут в корзину — у них нет офферов или их нет в каталоге.
                  </p>
                ) : null}

                {prescription.status === "MovedToCart" ? (
                  <div className="rounded-2xl bg-primary-soft p-4 text-sm">
                    Позиции переброшены в корзину. <a href="/cart" className="font-bold text-primary underline">Открыть корзину</a>
                  </div>
                ) : prescription.status === "OrderPlaced" ? (
                  <div className="rounded-2xl bg-primary-soft p-4 text-sm">
                    Заказ оформлен. <a href="/orders" className="font-bold text-primary underline">Мои заказы</a>
                  </div>
                ) : null}
              </section>
            ) : prescription.status === "Decoded" ? (
              <section className="rounded-2xl bg-surface-container-low p-4 text-sm text-on-surface-variant">
                Чек-лист пуст.
              </section>
            ) : (
              <section className="rounded-2xl bg-surface-container-low p-4 text-sm text-on-surface-variant">
                Фармацевт ещё не прислал чек-лист. Как только расшифровка будет
                готова — она появится здесь.
              </section>
            )}
          </>
        )}
      </div>
      <AuthedImageLightbox src={lightboxSrc} onClose={() => setLightboxSrc(null)} />
    </AppShell>
  );
}

/* ===================================================================
   PairSideRow — one half of a paired (analog ↔ original) checklist
   block on the client's prescription detail. The whole row is a button
   when the prescription is editable so tapping anywhere on a side
   selects it. The radio dot left of the image mirrors selection state;
   ineligible sides (manual entry / no offers / qty=0) render greyed
   out and the "Выбрать" affordance is suppressed — the order falls
   back to the OTHER side automatically.
   =================================================================== */
function PairSideRow({
  role,
  item,
  isSelected,
  editable,
  medicineCache,
  getEffectiveQty,
  onSelect,
  onSetQty,
  onOpenDetails,
}: {
  role: "analog" | "original";
  item: ApiPrescription["items"][number];
  isSelected: boolean;
  editable: boolean;
  medicineCache: Record<string, ApiMedicine>;
  getEffectiveQty: (itemId: string, recommended: number) => number;
  onSelect?: () => void;
  onSetQty: (qty: number) => void;
  onOpenDetails?: () => void;
}) {
  const med = item.medicineId ? medicineCache[item.medicineId] : undefined;
  const offerCount = med?.offers?.length ?? 0;
  const minPrice = getCheapestPrice(med ?? undefined);
  const imgUrl = med ? resolveMedicineImageUrl(med, 240) : "";
  const title = item.manualMedicineName ?? (med ? getMedicineDisplayName(med) : "Загружаем…");
  const isManual = !item.medicineId;
  // Same temp-offer treatment as SingletonRow — manual lookup with at
  // least one pharmacy response is orderable.
  const tempCount = item.temporaryOfferCount ?? 0;
  const tempMinPrice = item.temporaryOfferMinPrice ?? null;
  const hasTempOffers = isManual && !!item.lookupRequestId && tempCount > 0 && tempMinPrice != null;
  const noOffers = !isManual && offerCount === 0;
  const ineligible = !((!isManual && !noOffers) || hasTempOffers);
  const effective = !ineligible ? getEffectiveQty(item.id, item.quantity) : item.quantity;
  const removed = effective <= 0;
  const displayMinPrice = hasTempOffers ? tempMinPrice : minPrice ?? null;
  const displayOfferCount = hasTempOffers ? tempCount : offerCount;
  const [commentOpen, setCommentOpen] = useState(false);

  return (
    <div
      className={`rounded-2xl p-3 transition ${
        isSelected
          ? "bg-surface-container-lowest ring-2 ring-primary"
          : "bg-surface-container-lowest/80"
      } ${removed ? "opacity-60" : ""}`}
    >
      <div className="flex items-center gap-3">
        {/* Radio (left of image). Disabled visually for ineligible sides. */}
        <button
          type="button"
          onClick={onSelect}
          disabled={!editable || ineligible}
          aria-label={isSelected ? "Выбрано" : "Выбрать"}
          className={`flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full border-2 transition ${
            isSelected ? "border-primary bg-primary" : "border-outline bg-surface-container-lowest"
          } ${!editable || ineligible ? "cursor-not-allowed opacity-30" : "hover:border-primary"}`}
        >
          {isSelected ? <Icon name="check" size={12} className="text-white" /> : null}
        </button>

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
          <div className="flex items-center gap-2">
            <span
              className={`text-[10px] font-extrabold uppercase tracking-wider ${
                role === "analog" ? "text-primary" : "text-on-surface-variant"
              }`}
            >
              {role === "analog" ? "Аналог" : "Оригинал"}
            </span>
            {ineligible ? (
              <span className="rounded-full bg-secondary-soft px-2 py-0.5 text-[10px] font-bold text-secondary">
                Недоступно
              </span>
            ) : null}
          </div>
          {role === "analog" ? (
            <p className="text-[10px] font-semibold leading-tight text-primary/80">
              Рекомендация фармацевта по вашим запросам
            </p>
          ) : null}
          <p className="line-clamp-2 text-sm font-bold leading-tight">
            {title}
            {hasTempOffers ? (
              <span className="ml-2 rounded-full bg-tertiary/15 px-2 py-0.5 align-middle text-[10px] font-bold text-tertiary">
                предложение аптеки
              </span>
            ) : null}
          </p>
          {ineligible ? (
            <p className="mt-0.5 text-[11px] font-semibold text-secondary">
              {isManual ? "Нет в каталоге" : "Нет офферов"}
            </p>
          ) : (
            <p className="mt-0.5 text-[11px] text-on-surface-variant">
              от <span className="font-bold text-primary">{displayMinPrice ? formatMoney(displayMinPrice) : "—"}</span>
              {displayOfferCount > 0 ? (
                <span>
                  {" "}· в {displayOfferCount} {displayOfferCount === 1 ? "аптеке" : "аптеках"}
                </span>
              ) : null}
            </p>
          )}
        </div>

        <div className="flex flex-shrink-0 flex-col items-end gap-1">
          {editable && !ineligible ? (
            <>
              <div className="flex items-center gap-1">
                <div className="flex items-center gap-0.5 rounded-full bg-surface-container-low p-0.5">
                  <button
                    type="button"
                    onClick={() => onSetQty(effective - 1)}
                    disabled={effective <= 0}
                    className="flex h-7 w-7 items-center justify-center rounded-full text-primary transition hover:bg-primary/10 active:scale-95 disabled:opacity-40"
                    aria-label="Меньше"
                  >
                    <Icon name="minus" size={14} />
                  </button>
                  <span className="min-w-[1.5rem] text-center text-xs font-extrabold tabular-nums">
                    {effective}
                  </span>
                  <button
                    type="button"
                    onClick={() => onSetQty(effective + 1)}
                    className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-white transition hover:bg-primary-container active:scale-95"
                    aria-label="Больше"
                  >
                    <Icon name="plus" size={14} />
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => onSetQty(0)}
                  disabled={effective === 0}
                  className="flex h-7 w-7 items-center justify-center rounded-full text-on-surface-variant transition hover:bg-secondary-soft hover:text-secondary disabled:opacity-30"
                  aria-label="Убрать"
                >
                  <Icon name="close" size={14} />
                </button>
              </div>
              {effective !== item.quantity ? (
                <span className="text-[10px] font-bold tabular-nums text-secondary">
                  Рек.: {item.quantity}
                </span>
              ) : null}
            </>
          ) : (
            <span className="rounded-full bg-surface-container-low px-2.5 py-1 text-xs font-extrabold tabular-nums">
              ×{item.quantity}
            </span>
          )}
        </div>
      </div>

      <ItemRowFooter
        item={item}
        commentOpen={commentOpen}
        onToggleComment={() => setCommentOpen((v) => !v)}
        onOpenDetails={onOpenDetails}
        canOpenDetails={!isManual}
      />
    </div>
  );
}

/* ===================================================================
   SingletonRow — one prescription checklist line that has no analog
   pair. Mirrors PairSideRow's footer affordances (Комментарий + Подробно)
   so client-side interactions feel consistent regardless of whether the
   line happens to be paired or not.
   =================================================================== */
function SingletonRow({
  item,
  editable,
  medicineCache,
  getEffectiveQty,
  onSetQty,
  onOpenDetails,
}: {
  item: ApiPrescription["items"][number];
  editable: boolean;
  medicineCache: Record<string, ApiMedicine>;
  getEffectiveQty: (itemId: string, recommended: number) => number;
  onSetQty: (qty: number) => void;
  onOpenDetails?: () => void;
}) {
  const med = item.medicineId ? medicineCache[item.medicineId] : undefined;
  const offerCount = med?.offers?.length ?? 0;
  const minPrice = getCheapestPrice(med ?? undefined);
  const imgUrl = med ? resolveMedicineImageUrl(med, 240) : "";
  const title = item.manualMedicineName ?? (med ? getMedicineDisplayName(med) : "Загружаем…");
  const isManual = !item.medicineId;
  // Manual lookup with at least one pharmacy response: render the row
  // as an ordinary orderable item (price + N pharmacies + qty stepper).
  // The "Нет в каталоге" red badge is reserved for manual rows that
  // either have no lookup or no responses yet.
  const tempCount = item.temporaryOfferCount ?? 0;
  const tempMinPrice = item.temporaryOfferMinPrice ?? null;
  const hasTempOffers = isManual && !!item.lookupRequestId && tempCount > 0 && tempMinPrice != null;
  const noOffers = !isManual && offerCount === 0;
  const orderable = (!isManual && !noOffers) || hasTempOffers;
  const effective = orderable ? getEffectiveQty(item.id, item.quantity) : item.quantity;
  const removed = effective <= 0;
  const recDiff = effective !== item.quantity;
  const [commentOpen, setCommentOpen] = useState(false);

  // Effective price/count chosen between catalog offers and manual
  // temp offers — manual lookup wins when present (it's the only one
  // available for that line anyway).
  const displayMinPrice = hasTempOffers ? tempMinPrice : minPrice ?? null;
  const displayOfferCount = hasTempOffers ? tempCount : offerCount;
  return (
    <li
      className={`rounded-2xl bg-surface-container-lowest p-3 shadow-card xs:p-4 transition ${
        !orderable ? "ring-1 ring-secondary/30" : ""
      } ${removed ? "opacity-50" : ""}`}
    >
      <div className="flex items-center gap-3 xs:gap-4">
        <div className="h-12 w-12 flex-shrink-0 overflow-hidden rounded-xl bg-image-backdrop xs:h-14 xs:w-14">
          {imgUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={imgUrl} alt="" className="h-full w-full object-contain mix-blend-multiply" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-on-surface-variant/40">
              <Icon name="pharmacy" size={20} />
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="line-clamp-2 text-sm font-bold leading-tight">
            {title}
            {hasTempOffers ? (
              <span className="ml-2 rounded-full bg-tertiary/15 px-2 py-0.5 align-middle text-[10px] font-bold text-tertiary">
                предложение аптеки
              </span>
            ) : null}
          </p>
          {orderable ? (
            <p className="mt-0.5 text-[11px] text-on-surface-variant">
              от <span className="font-bold text-primary">{displayMinPrice ? formatMoney(displayMinPrice) : "—"}</span>
              {displayOfferCount > 0 ? (
                <span>
                  {" "}· в {displayOfferCount} {displayOfferCount === 1 ? "аптеке" : "аптеках"}
                </span>
              ) : null}
            </p>
          ) : isManual ? (
            <p className="mt-0.5 text-[11px] font-semibold text-secondary">
              Нет в каталоге — недоступно для онлайн-заказа
            </p>
          ) : (
            <p className="mt-0.5 text-[11px] font-semibold text-secondary">
              Нет в наличии в аптеках сейчас
            </p>
          )}
        </div>
        <div className="flex flex-shrink-0 flex-col items-end gap-1">
          {orderable && editable ? (
            <>
              <div className="flex items-center gap-1">
                <div className="flex items-center gap-0.5 rounded-full bg-surface-container-low p-0.5">
                  <button
                    type="button"
                    onClick={() => onSetQty(effective - 1)}
                    disabled={effective <= 0}
                    className="flex h-7 w-7 items-center justify-center rounded-full text-primary transition hover:bg-primary/10 active:scale-95 disabled:opacity-40"
                    aria-label="Меньше"
                  >
                    <Icon name="minus" size={14} />
                  </button>
                  <span className="min-w-[1.5rem] text-center text-xs font-extrabold tabular-nums">
                    {effective}
                  </span>
                  <button
                    type="button"
                    onClick={() => onSetQty(effective + 1)}
                    className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-white transition hover:bg-primary-container active:scale-95"
                    aria-label="Больше"
                  >
                    <Icon name="plus" size={14} />
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => onSetQty(0)}
                  disabled={effective === 0}
                  title={effective === 0 ? "Позиция удалена — нажмите +, чтобы вернуть" : "Убрать позицию из заказа"}
                  className="flex h-7 w-7 items-center justify-center rounded-full text-on-surface-variant transition hover:bg-secondary-soft hover:text-secondary disabled:opacity-30"
                  aria-label="Убрать позицию"
                >
                  <Icon name="close" size={14} />
                </button>
              </div>
              <span className={`text-[10px] tabular-nums ${recDiff ? "font-bold text-secondary" : "text-on-surface-variant"}`}>
                Рек.: {item.quantity}
              </span>
            </>
          ) : (
            <span className="rounded-full bg-surface-container-low px-2.5 py-1 text-xs font-extrabold tabular-nums">
              ×{item.quantity}
            </span>
          )}
        </div>
      </div>
      <ItemRowFooter
        item={item}
        commentOpen={commentOpen}
        onToggleComment={() => setCommentOpen((v) => !v)}
        onOpenDetails={onOpenDetails}
        canOpenDetails={!isManual}
      />
    </li>
  );
}

/* ===================================================================
   ItemRowFooter — small action row under any prescription checklist
   item (singleton or pair side). Two affordances: "Комментарий" toggles
   the pharmacist's per-item note, "Подробно" pushes ?product=<slug>
   to open the global ProductModal. Comment button is hidden when there
   is no comment to show. Details button is hidden for manual entries
   (no catalog entry to open).
   =================================================================== */
function ItemRowFooter({
  item,
  commentOpen,
  onToggleComment,
  onOpenDetails,
  canOpenDetails,
}: {
  item: ApiPrescription["items"][number];
  commentOpen: boolean;
  onToggleComment: () => void;
  onOpenDetails?: () => void;
  canOpenDetails: boolean;
}) {
  const hasComment = !!item.pharmacistComment;
  if (!hasComment && !canOpenDetails) return null;
  return (
    <>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        {hasComment ? (
          <button
            type="button"
            onClick={onToggleComment}
            className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold transition ${
              commentOpen
                ? "bg-primary text-white"
                : "bg-surface-container-low text-on-surface hover:bg-image-backdrop"
            }`}
          >
            <Icon name="orders" size={12} />
            {commentOpen ? "Скрыть комментарий" : "Комментарий"}
          </button>
        ) : null}
        {canOpenDetails && onOpenDetails ? (
          <button
            type="button"
            onClick={onOpenDetails}
            className="flex items-center gap-1 rounded-full bg-surface-container-low px-2.5 py-1 text-[11px] font-semibold text-on-surface transition hover:bg-image-backdrop"
          >
            <Icon name="search" size={12} />
            Подробно
          </button>
        ) : null}
      </div>
      {hasComment && commentOpen ? (
        <div className="mt-2 rounded-xl bg-primary-soft p-2.5">
          <p className="mb-0.5 text-[10px] font-bold uppercase tracking-wider text-primary">
            Комментарий фармацевта
          </p>
          <p className="text-xs leading-relaxed text-on-surface">{item.pharmacistComment}</p>
        </div>
      ) : null}
    </>
  );
}
