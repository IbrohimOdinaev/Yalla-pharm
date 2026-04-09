"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getActivePharmacies, type ActivePharmacy } from "@/entities/pharmacy/api";
import { useAppSelector } from "@/shared/lib/redux";
import { useCheckoutDraftStore } from "@/features/checkout/model/checkoutDraftStore";
import { AppShell } from "@/widgets/layout/AppShell";
import { TopBar } from "@/widgets/layout/TopBar";

export default function PharmaciesMapPage() {
  const token = useAppSelector((state) => state.auth.token);
  const selectedPharmacyId = useCheckoutDraftStore((state) => state.pharmacyId);
  const setDraft = useCheckoutDraftStore((state) => state.setDraft);

  const [pharmacies, setPharmacies] = useState<ActivePharmacy[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setIsLoading(false);
      return;
    }

    getActivePharmacies(token)
      .then((data) => {
        setPharmacies(data);
        setIsLoading(false);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Не удалось загрузить аптеки.");
        setIsLoading(false);
      });
  }, [token]);

  return (
    <AppShell top={<TopBar title="Выбор аптеки" backHref="back" />}>
      {!token ? (
        <div className="stitch-card p-6 text-sm">
          Чтобы выбрать аптеку, нужно <Link href="/login" className="font-bold text-primary">войти в аккаунт</Link>.
        </div>
      ) : (
        <div className="space-y-4">
          <div className="stitch-card overflow-hidden">
            <div className="h-56 bg-gradient-to-br from-primary/20 via-surface-container to-secondary/20" />
            <div className="border-t border-surface-container-high px-4 py-3 text-sm text-on-surface-variant">
              Карта выбора аптеки (экран адаптирован из Stitch).
            </div>
          </div>

          {isLoading ? <div className="stitch-card p-5 text-sm">Загружаем аптеки...</div> : null}
          {error ? <div className="rounded-xl bg-red-100 p-3 text-sm text-red-700">{error}</div> : null}

          {(pharmacies || []).map((pharmacy) => {
            const selected = selectedPharmacyId === pharmacy.id;
            return (
              <article key={pharmacy.id} className="stitch-card p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-bold">{pharmacy.title}</h3>
                    <p className="text-sm text-on-surface-variant">{pharmacy.address}</p>
                  </div>
                  <button
                    type="button"
                    className={selected ? "stitch-button" : "stitch-button-secondary"}
                    onClick={() => setDraft({ pharmacyId: pharmacy.id })}
                  >
                    {selected ? "Выбрано" : "Выбрать"}
                  </button>
                </div>
              </article>
            );
          })}

          <Link href="/checkout" className="stitch-button block text-center">Продолжить к checkout</Link>
        </div>
      )}
    </AppShell>
  );
}
