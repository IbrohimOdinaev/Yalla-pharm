"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { getMedicineById, getMedicineDisplayName, resolveMedicineImageUrl } from "@/entities/medicine/api";
import type { ApiMedicine } from "@/shared/types/api";
import { formatMoney } from "@/shared/lib/format";
import { useCartStore } from "@/features/cart/model/cartStore";
import { useAppSelector } from "@/shared/lib/redux";
import { AppShell } from "@/widgets/layout/AppShell";
import { TopBar } from "@/widgets/layout/TopBar";

export default function ProductDetailsPage() {
  const params = useParams<{ id: string }>();
  const id = String(params?.id || "");
  const token = useAppSelector((state) => state.auth.token);
  const addItem = useCartStore((state) => state.addItem);

  const [medicine, setMedicine] = useState<ApiMedicine | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  const imageUrl = useMemo(() => resolveMedicineImageUrl(medicine ?? undefined), [medicine]);

  return (
    <AppShell top={<TopBar title="Карточка товара" backHref="/" />}>
      {isLoading ? <div className="stitch-card p-6 text-sm">Загружаем товар...</div> : null}
      {error ? <div className="rounded-xl bg-red-100 p-4 text-sm text-red-700">{error}</div> : null}

      {medicine ? (
        <section className="space-y-5">
          <div className="overflow-hidden rounded-2xl bg-surface-container-high shadow-card">
            {imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={imageUrl} alt={getMedicineDisplayName(medicine)} className="h-[320px] w-full object-cover" />
            ) : (
              <div className="flex h-[320px] items-center justify-center text-on-surface-variant">Нет изображения</div>
            )}
          </div>

          <div className="stitch-card space-y-4 p-6">
            <div>
              <h1 className="text-2xl font-extrabold text-primary">{getMedicineDisplayName(medicine)}</h1>
              <p className="mt-2 text-sm text-on-surface-variant">{medicine.description || "Описание временно недоступно."}</p>
            </div>

            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-xl bg-surface-container-low p-3">
                <p className="text-xs text-on-surface-variant">Дозировка</p>
                <p className="font-semibold">{medicine.dosage || "—"}</p>
              </div>
              <div className="rounded-xl bg-surface-container-low p-3">
                <p className="text-xs text-on-surface-variant">Производитель</p>
                <p className="font-semibold">{medicine.manufacturer || "—"}</p>
              </div>
            </div>

            <div className="flex items-center justify-between gap-4">
              <p className="text-2xl font-black text-primary">{formatMoney(medicine.price)}</p>
              {token ? (
                <button
                  type="button"
                  className="stitch-button"
                  onClick={() => {
                    addItem(token, medicine.id).catch(() => undefined);
                  }}
                >
                  Добавить в корзину
                </button>
              ) : (
                <Link href="/login" className="stitch-button">Войти и купить</Link>
              )}
            </div>
          </div>
        </section>
      ) : null}
    </AppShell>
  );
}
