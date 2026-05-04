"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAppSelector } from "@/shared/lib/redux";
import {
  getMyPrescriptions,
  markPrescriptionPaid,
  moveChecklistToCart,
  PRESCRIPTION_STATUS_LABEL_RU,
  type ApiPrescription,
} from "@/entities/prescription/api";
import { getMedicineById, getMedicineDisplayName, getCheapestPrice, resolveMedicineImageUrl } from "@/entities/medicine/api";
import type { ApiMedicine } from "@/shared/types/api";
import { formatMoney } from "@/shared/lib/format";
import { AppShell } from "@/widgets/layout/AppShell";
import { TopBar } from "@/widgets/layout/TopBar";
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
  const [marking, setMarking] = useState(false);
  const [moving, setMoving] = useState<"order" | "cart" | null>(null);
  const [medicineCache, setMedicineCache] = useState<Record<string, ApiMedicine>>({});

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

  // Pull medicine details for every catalog-bound item so the row can show
  // photo, canonical title, min price and offers count — same shape the
  // regular cart uses.
  useEffect(() => {
    if (!prescription) return;
    const ids = prescription.items
      .map((i) => i.medicineId)
      .filter((m): m is string => !!m && !medicineCache[m]);
    if (ids.length === 0) return;
    let cancelled = false;
    Promise.all(ids.map((mid) =>
      getMedicineById(mid).then((m) => [mid, m] as const).catch(() => [mid, null] as const)
    )).then((entries) => {
      if (cancelled) return;
      setMedicineCache((prev) => {
        const next = { ...prev };
        for (const [mid, m] of entries) if (m) next[mid] = m;
        return next;
      });
    });
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
      if (offerCount > 0 && price) {
        available++;
        totalCost += price * it.quantity;
      } else {
        unavailable++;
      }
    }
    return { available, unavailable, manual, totalCost };
  }, [prescription, medicineCache]);

  async function handleMove(redirectTo: "/cart/pharmacy" | "/cart") {
    if (!token || !prescription) return;
    setMoving(redirectTo === "/cart/pharmacy" ? "order" : "cart");
    setError(null);
    try {
      const result = await moveChecklistToCart(token, prescription.prescriptionId);
      if (result.movedItemsCount === 0) {
        setError(redirectTo === "/cart/pharmacy"
          ? "Нечего оформлять — у позиций нет офферов."
          : "Нечего перемещать — у позиций нет офферов.");
        return;
      }
      router.push(redirectTo);
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
              <span className="text-xs text-on-surface-variant">
                {new Date(prescription.createdAtUtc).toLocaleString("ru-RU")}
              </span>
            </div>

            {/* Submitted = client uploaded but hasn't confirmed payment yet. */}
            {prescription.status === "Submitted" ? (
              <section className="space-y-3 rounded-2xl bg-accent-soft p-4">
                <p className="text-sm font-bold text-on-surface">Ожидаем подтверждения оплаты</p>
                <p className="text-xs text-on-surface-variant">
                  Если вы уже оплатили 3 TJS на странице DushanbeCity — нажмите кнопку ниже.
                  После этого SuperAdmin сверит платёж и заявка уйдёт фармацевту.
                </p>
                <Button
                  size="md"
                  loading={marking}
                  onClick={async () => {
                    if (!token) return;
                    setMarking(true);
                    setError(null);
                    try {
                      await markPrescriptionPaid(token, id);
                      const reloaded = await getMyPrescriptions(token);
                      setAll(reloaded);
                    } catch (err) {
                      setError(err instanceof Error ? err.message : "Не удалось отметить оплату.");
                    } finally {
                      setMarking(false);
                    }
                  }}
                >
                  Я оплатил
                </Button>
              </section>
            ) : null}

            <section className="space-y-2">
              <h2 className="font-display text-base font-extrabold">Фото</h2>
              <div className="grid grid-cols-2 gap-3">
                {prescription.images.map((img) => (
                  <div
                    key={img.id}
                    className="relative aspect-[3/4] overflow-hidden rounded-2xl bg-surface-container shadow-card"
                  >
                    <AuthedImage src={img.url} alt="" className="h-full w-full object-cover" />
                  </div>
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
                    const imgUrl = med ? resolveMedicineImageUrl(med, 120) : "";
                    const title = it.manualMedicineName
                      ?? (med ? getMedicineDisplayName(med) : "Загружаем…");
                    const isManual = !it.medicineId;
                    const noOffers = !isManual && offerCount === 0;

                    return (
                      <li
                        key={it.id}
                        className={`flex items-center gap-3 rounded-2xl bg-surface-container-lowest p-3 shadow-card xs:gap-4 xs:p-4 ${
                          isManual || noOffers ? "ring-1 ring-secondary/30" : ""
                        }`}
                      >
                        <div className="h-12 w-12 flex-shrink-0 overflow-hidden rounded-xl bg-surface-container xs:h-14 xs:w-14">
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

                        <div className="flex flex-shrink-0 flex-col items-end gap-0.5">
                          <span className="rounded-full bg-surface-container-low px-2.5 py-1 text-xs font-extrabold tabular-nums">
                            ×{it.quantity}
                          </span>
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
                      loading={moving === "order"}
                      onClick={() => handleMove("/cart/pharmacy")}
                      disabled={checklistTotals.available === 0}
                    >
                      Оформить заказ
                    </Button>
                    <Button
                      size="lg"
                      variant="secondary"
                      fullWidth
                      loading={moving === "cart"}
                      onClick={() => handleMove("/cart")}
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
    </AppShell>
  );
}
