"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
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
import { AuthedImageLightbox } from "@/widgets/prescription/AuthedImageLightbox";
import { AuthedImage, Button, Chip, Icon } from "@/shared/ui";

export default function PrescriptionDetailPage() {
  const params = useParams<{ id: string }>();
  const id = String(params?.id || "");
  const router = useRouter();
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
  // Persisted to sessionStorage so a tab refresh / nav back doesn't lose the
  // edits. /cart/pharmacy reads the same key when entering prescription mode,
  // and `moveChecklistToCart` posts the same map as `quantityOverrides` to
  // the backend so "В корзину" respects the client's edits too.
  const [editedQty, setEditedQty] = useState<Record<string, number>>({});
  const overridesStorageKey = `yalla.prescription.qty.${id}`;
  useEffect(() => {
    if (typeof window === "undefined" || !id) return;
    try {
      const raw = sessionStorage.getItem(overridesStorageKey);
      if (raw) setEditedQty(JSON.parse(raw));
    } catch { /* ignore */ }
  }, [id, overridesStorageKey]);
  function persistEditedQty(next: Record<string, number>) {
    setEditedQty(next);
    if (typeof window === "undefined") return;
    try {
      if (Object.keys(next).length === 0) sessionStorage.removeItem(overridesStorageKey);
      else sessionStorage.setItem(overridesStorageKey, JSON.stringify(next));
    } catch { /* ignore */ }
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

  const checklistTotals = useMemo(() => {
    if (!prescription) return { available: 0, unavailable: 0, manual: 0, totalCost: 0 };
    let available = 0, unavailable = 0, manual = 0, totalCost = 0;
    for (const it of prescription.items) {
      if (!it.medicineId) { manual++; continue; }
      const med = medicineCache[it.medicineId];
      const offerCount = med?.offers?.length ?? 0;
      const price = getCheapestPrice(med ?? undefined);
      // Effective qty respects client edits, INCLUDING explicit 0 ("removed").
      // Removed positions don't count toward the available/total pill — they
      // also won't be sent to the cart or checkout.
      const effectiveQty = it.id in editedQty ? editedQty[it.id] : it.quantity;
      if (effectiveQty <= 0) continue;
      if (offerCount > 0 && price) {
        available++;
        totalCost += price * effectiveQty;
      } else {
        unavailable++;
      }
    }
    return { available, unavailable, manual, totalCost };
  }, [prescription, medicineCache, editedQty]);

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
        editedQty,
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
                  {prescription.items.map((it) => {
                    const med = it.medicineId ? medicineCache[it.medicineId] : undefined;
                    const offerCount = med?.offers?.length ?? 0;
                    const minPrice = getCheapestPrice(med ?? undefined);
                    const imgUrl = med ? resolveMedicineImageUrl(med, 240) : "";
                    const title = it.manualMedicineName
                      ?? (med ? getMedicineDisplayName(med) : "Загружаем…");
                    const isManual = !it.medicineId;
                    const noOffers = !isManual && offerCount === 0;
                    // qty=0 means the client deliberately removed the item;
                    // it's kept on the page (with reduced opacity) so they can
                    // bring it back, but it won't go to cart/checkout.
                    const effective = !isManual && !noOffers
                      ? getEffectiveQty(it.id, it.quantity)
                      : it.quantity;
                    const removed = effective <= 0;

                    return (
                      <li
                        key={it.id}
                        className={`flex items-center gap-3 rounded-2xl bg-surface-container-lowest p-3 shadow-card xs:gap-4 xs:p-4 transition ${
                          isManual || noOffers ? "ring-1 ring-secondary/30" : ""
                        } ${removed ? "opacity-50" : ""}`}
                      >
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
                          </p>
                          {isManual ? (
                            <p className="mt-0.5 text-[11px] font-semibold text-secondary">
                              Нет в каталоге — недоступно для онлайн-заказа
                            </p>
                          ) : noOffers ? (
                            <p className="mt-0.5 text-[11px] font-semibold text-secondary">
                              Нет в наличии в аптеках сейчас
                            </p>
                          ) : (
                            <p className="mt-0.5 text-[11px] text-on-surface-variant">
                              от <span className="font-bold text-primary">{minPrice ? formatMoney(minPrice) : "—"}</span>
                              {offerCount > 0 ? <span> · в {offerCount} {offerCount === 1 ? "аптеке" : "аптеках"}</span> : null}
                            </p>
                          )}
                          {it.pharmacistComment ? (
                            <p className="mt-1 line-clamp-2 text-[11px] text-on-surface-variant">
                              {it.pharmacistComment}
                            </p>
                          ) : null}
                        </div>

                        <div className="flex flex-shrink-0 flex-col items-end gap-1">
                          {!isManual && !noOffers && prescription.status === "Decoded" ? (
                            // Editable stepper — only for orderable items
                            // (catalog-bound + has offers). Going from 1 → 0
                            // (or pressing the dedicated × button) "removes"
                            // the item — the row dims and qty=0 is sent to
                            // backend / cart so it's excluded from the order.
                            // The "Рек.: N" sub-label always shows the
                            // pharmacist's original recommendation so the
                            // client can compare before/after their edits.
                            (() => {
                              const recDiff = effective !== it.quantity;
                              return (
                                <>
                                  <div className="flex items-center gap-1">
                                    <div className="flex items-center gap-0.5 rounded-full bg-surface-container-low p-0.5">
                                      <button
                                        type="button"
                                        onClick={() => setItemQty(it.id, it.quantity, effective - 1)}
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
                                        onClick={() => setItemQty(it.id, it.quantity, effective + 1)}
                                        className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-white transition hover:bg-primary-container active:scale-95"
                                        aria-label="Больше"
                                      >
                                        <Icon name="plus" size={14} />
                                      </button>
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() => setItemQty(it.id, it.quantity, 0)}
                                      disabled={effective === 0}
                                      title={effective === 0 ? "Позиция удалена — нажмите +, чтобы вернуть" : "Убрать позицию из заказа"}
                                      className="flex h-7 w-7 items-center justify-center rounded-full text-on-surface-variant transition hover:bg-secondary-soft hover:text-secondary disabled:opacity-30"
                                      aria-label="Убрать позицию"
                                    >
                                      <Icon name="close" size={14} />
                                    </button>
                                  </div>
                                  <span className={`text-[10px] tabular-nums ${recDiff ? "font-bold text-secondary" : "text-on-surface-variant"}`}>
                                    Рек.: {it.quantity}
                                  </span>
                                </>
                              );
                            })()
                          ) : (
                            <span className="rounded-full bg-surface-container-low px-2.5 py-1 text-xs font-extrabold tabular-nums">
                              ×{it.quantity}
                            </span>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>

                {prescription.status === "Decoded" ? (
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
