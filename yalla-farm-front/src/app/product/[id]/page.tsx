"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { getMedicineById, getMedicineDisplayName, getMainImageUrl, getGalleryImages, getCheapestPrice } from "@/entities/medicine/api";
import type { ApiMedicine } from "@/shared/types/api";
import { formatMoney } from "@/shared/lib/format";
import { useCartStore } from "@/features/cart/model/cartStore";
import { useGuestCartStore } from "@/features/cart/model/guestCartStore";
import { useAppSelector } from "@/shared/lib/redux";
import { useOfferLiveUpdates } from "@/features/catalog/model/useOfferLiveUpdates";
import { AppShell } from "@/widgets/layout/AppShell";
import { TopBar } from "@/widgets/layout/TopBar";
import { Button, Chip, Icon, IconButton } from "@/shared/ui";

export default function ProductDetailsPage() {
  const params = useParams<{ id: string }>();
  const id = String(params?.id || "");
  const token = useAppSelector((state) => state.auth.token);
  const addItem = useCartStore((state) => state.addItem);
  const addGuestItem = useGuestCartStore((state) => state.addItem);

  const role = useAppSelector((state) => state.auth.role);

  const [medicine, setMedicine] = useState<ApiMedicine | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [activeImageIdx, setActiveImageIdx] = useState(0);
  const [added, setAdded] = useState(false);

  useOfferLiveUpdates(useCallback((payload) => {
    if (medicine && payload.medicineId === medicine.id) {
      getMedicineById(id).then(setMedicine).catch(() => undefined);
    }
  }, [medicine, id]));

  useEffect(() => {
    if (!id) {
      setError("Некорректный идентификатор товара.");
      setIsLoading(false);
      return;
    }

    getMedicineById(id)
      .then((value) => {
        setMedicine(value);
        setIsLoading(false);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Не удалось загрузить товар.");
        setIsLoading(false);
      });
  }, [id]);

  const gallery = useMemo(() => getGalleryImages(medicine ?? undefined, 800), [medicine]);
  const activeImage = gallery[activeImageIdx] || getMainImageUrl(medicine ?? undefined, 800);
  const cheapestPrice = useMemo(() => getCheapestPrice(medicine ?? undefined), [medicine]);
  const offersCount = medicine?.offers?.length ?? 0;
  const inStock = (medicine?.offers ?? []).some((o) => (o.stockQuantity ?? 0) > 0);

  function onAddToCart() {
    if (!medicine) return;
    if (token) addItem(token, medicine.id, quantity).catch(() => undefined);
    else addGuestItem(medicine.id, quantity);
    setAdded(true);
    setTimeout(() => setAdded(false), 2000);
  }

  return (
    <AppShell hideFooter top={<TopBar title="Товар" backHref="back" />}>
      {isLoading ? (
        <div className="rounded-3xl bg-surface-container-low p-8 text-sm">Загружаем товар...</div>
      ) : null}
      {error ? (
        <div className="rounded-2xl bg-secondary/10 p-3 text-sm font-semibold text-secondary">{error}</div>
      ) : null}

      {medicine ? (
        <div className="mx-auto max-w-3xl space-y-4 pb-24">
          {/* Gallery */}
          <div className="space-y-3">
            <div
              className="relative aspect-square overflow-hidden rounded-3xl bg-accent-mint shadow-card"
              onTouchStart={(e) => { (e.currentTarget as HTMLElement).dataset.touchX = String(e.touches[0].clientX); }}
              onTouchEnd={(e) => {
                const startX = (e.currentTarget as HTMLElement).dataset.touchX;
                if (!startX) return;
                const diff = e.changedTouches[0].clientX - Number(startX);
                if (Math.abs(diff) < 40) return;
                if (diff < 0 && activeImageIdx < gallery.length - 1) setActiveImageIdx((i) => i + 1);
                if (diff > 0 && activeImageIdx > 0) setActiveImageIdx((i) => i - 1);
              }}
            >
              {activeImage ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={activeImage}
                  alt={getMedicineDisplayName(medicine)}
                  className="h-full w-full object-contain p-6"
                />
              ) : (
                <div className="flex h-full items-center justify-center text-primary/40">
                  <Icon name="pharmacy" size={64} />
                </div>
              )}

              {gallery.length > 1 ? (
                <>
                  {activeImageIdx > 0 ? (
                    <IconButton
                      icon="chevron-left"
                      variant="floating"
                      size="md"
                      onClick={() => setActiveImageIdx((i) => i - 1)}
                      aria-label="Предыдущее"
                      className="!absolute left-3 top-1/2 -translate-y-1/2"
                    />
                  ) : null}
                  {activeImageIdx < gallery.length - 1 ? (
                    <IconButton
                      icon="chevron-right"
                      variant="floating"
                      size="md"
                      onClick={() => setActiveImageIdx((i) => i + 1)}
                      aria-label="Следующее"
                      className="!absolute right-3 top-1/2 -translate-y-1/2"
                    />
                  ) : null}
                  <div className="absolute right-3 top-3 rounded-full bg-white/90 px-3 py-1 text-xs font-bold text-on-surface shadow-card">
                    {activeImageIdx + 1} / {gallery.length}
                  </div>
                  <div className="absolute bottom-3 left-0 right-0 flex justify-center gap-1.5">
                    {gallery.map((_, i) => (
                      <span
                        key={i}
                        className={`h-2 rounded-full transition ${
                          i === activeImageIdx ? "w-6 bg-primary" : "w-2 bg-white/70"
                        }`}
                      />
                    ))}
                  </div>
                </>
              ) : null}
            </div>

            {gallery.length > 1 ? (
              <div className="flex gap-2 overflow-x-auto scrollbar-hide scroll-touch -mx-3 px-3 pb-1">
                {gallery.map((url, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setActiveImageIdx(idx)}
                    className={`h-16 w-16 flex-shrink-0 overflow-hidden rounded-2xl bg-accent-mint transition ${
                      idx === activeImageIdx
                        ? "ring-2 ring-primary ring-offset-2 ring-offset-surface"
                        : "opacity-70 hover:opacity-100"
                    }`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={url} alt="" className="h-full w-full object-contain p-1.5" />
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          {/* Info card */}
          <section className="space-y-3 rounded-3xl bg-surface-container-lowest p-5 shadow-card">
            <div className="flex flex-wrap items-center gap-1.5">
              {medicine.categoryName ? (
                <Chip tone="primary" asButton={false} size="sm">{medicine.categoryName}</Chip>
              ) : null}
              {inStock ? (
                <Chip tone="success" asButton={false} leftIcon="check" size="sm">В наличии</Chip>
              ) : (
                <Chip tone="danger" asButton={false} size="sm">Нет в наличии</Chip>
              )}
              {offersCount > 0 ? (
                <Chip tone="tertiary" asButton={false} leftIcon="pharmacy" size="sm">
                  в {offersCount} {offersCount === 1 ? "аптеке" : offersCount < 5 ? "аптеках" : "аптеках"}
                </Chip>
              ) : null}
            </div>

            <div>
              <h1 className="font-display text-2xl font-extrabold leading-tight text-on-surface">
                {getMedicineDisplayName(medicine)}
              </h1>
              {medicine.articul ? (
                <p className="mt-1 font-mono text-xs text-on-surface-variant">Артикул: {medicine.articul}</p>
              ) : null}
            </div>

            <div className="flex items-baseline gap-2">
              <span className="font-display text-3xl font-extrabold text-primary tabular-nums">
                {cheapestPrice ? `${formatMoney(cheapestPrice)} TJS` : "—"}
              </span>
              {offersCount > 1 && cheapestPrice ? (
                <span className="text-xs font-semibold text-on-surface-variant">от</span>
              ) : null}
            </div>

            {medicine.description ? (
              <div
                className="prose prose-sm max-w-none text-sm leading-relaxed text-on-surface-variant"
                dangerouslySetInnerHTML={{ __html: medicine.description }}
              />
            ) : null}
          </section>

          {/* Attributes */}
          {(medicine.atributes ?? []).length > 0 ? (
            <section className="space-y-2">
              <h3 className="px-1 font-display text-base font-extrabold">Характеристики</h3>
              <div className="grid grid-cols-2 gap-2">
                {medicine.atributes!.map((attr, i) => (
                  <div key={i} className="rounded-2xl bg-surface-container-lowest p-3 shadow-card">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">
                      {attr.type || attr.name}
                    </p>
                    <p className="mt-0.5 text-sm font-bold text-on-surface">{attr.value || attr.option}</p>
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          {/* Pharmacy offers */}
          {(medicine.offers ?? []).length > 0 ? (
            <section className="space-y-2">
              <h3 className="px-1 font-display text-base font-extrabold">Купить в аптеке</h3>
              <div className="space-y-2">
                {medicine.offers!.map((offer) => (
                  <div
                    key={offer.pharmacyId}
                    className="flex items-center gap-3 rounded-2xl bg-surface-container-lowest p-3 shadow-card"
                  >
                    <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-accent-mint text-primary">
                      <Icon name="pharmacy" size={20} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold text-on-surface">
                        {offer.pharmacyTitle ?? offer.pharmacyId.slice(0, 8)}
                      </p>
                      <p className="text-xs text-on-surface-variant">
                        В наличии: {offer.stockQuantity} шт.
                      </p>
                    </div>
                    <span className="flex-shrink-0 font-display text-lg font-extrabold tabular-nums text-primary">
                      {formatMoney(offer.price)}
                    </span>
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          {/* Admin hint */}
          {(role === "Admin" || role === "SuperAdmin") ? (
            <div className="rounded-3xl bg-surface-container-low p-4">
              <p className="text-sm font-bold text-on-surface-variant">
                Режим {role === "Admin" ? "администратора" : "супер-админа"}
              </p>
              <p className="mt-1 text-xs text-on-surface-variant">
                Управление этим товаром доступно в вашем кабинете.
              </p>
              <Link
                href={role === "Admin" ? "/workspace" : "/superadmin"}
                className="mt-3 inline-block"
              >
                <Button variant="secondary" size="sm" rightIcon="arrow-right">
                  Открыть кабинет
                </Button>
              </Link>
            </div>
          ) : null}
        </div>
      ) : null}

      {/* Sticky bottom add-to-cart */}
      {medicine && role !== "Admin" && role !== "SuperAdmin" ? (
        <div className="fixed bottom-16 left-0 right-0 z-30 px-3 sm:bottom-4">
          <div className="mx-auto flex max-w-2xl items-center gap-2 rounded-full bg-surface-container-lowest p-1.5 shadow-glass">
            <div className="flex items-center gap-0.5 rounded-full bg-surface-container-low p-0.5">
              <button
                type="button"
                onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                className="flex h-10 w-10 items-center justify-center rounded-full text-primary transition hover:bg-primary/10 active:scale-95"
                aria-label="Уменьшить"
              >
                <Icon name="minus" size={16} />
              </button>
              <span className="min-w-[1.5rem] text-center text-sm font-extrabold tabular-nums">
                {quantity}
              </span>
              <button
                type="button"
                onClick={() => setQuantity((q) => q + 1)}
                className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-white transition hover:bg-primary-container active:scale-95"
                aria-label="Увеличить"
              >
                <Icon name="plus" size={16} />
              </button>
            </div>
            <Button
              size="lg"
              className="flex-1"
              leftIcon={added ? "check" : "bag"}
              onClick={onAddToCart}
              disabled={!inStock}
            >
              {added
                ? "Добавлено"
                : cheapestPrice
                  ? `В корзину · ${formatMoney(cheapestPrice * quantity)} TJS`
                  : "В корзину"}
            </Button>
          </div>
        </div>
      ) : null}
    </AppShell>
  );
}
