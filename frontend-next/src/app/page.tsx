"use client";

import { useEffect, useState } from "react";
import { getCatalogMedicines } from "@/entities/medicine/api";
import type { ApiMedicine } from "@/shared/types/api";
import { HeroCarousel } from "@/widgets/catalog/HeroCarousel";
import { MedicineCard } from "@/widgets/catalog/MedicineCard";
import { AppShell } from "@/widgets/layout/AppShell";
import { TopBar } from "@/widgets/layout/TopBar";
import { InfoBanner } from "@/shared/ui/InfoBanner";

export default function HomePage() {
  const [medicines, setMedicines] = useState<ApiMedicine[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getCatalogMedicines(1, 24)
      .then((data) => {
        setMedicines(data);
        setIsLoading(false);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Не удалось загрузить каталог.");
        setIsLoading(false);
      });
  }, []);

  return (
    <AppShell top={<TopBar title="Аптека Душанбе" />}>
      <section className="space-y-5">
        <div className="stitch-card p-5">
          <h2 className="text-lg font-bold">Куда доставить?</h2>
          <p className="mt-1 text-sm text-on-surface-variant">Предоставьте доступ к геолокации или выберите аптеку вручную на карте.</p>
          <div className="mt-4 flex gap-3">
            <button className="stitch-button">Разрешить доступ</button>
            <button className="stitch-button-secondary">Ввести адрес</button>
          </div>
        </div>

        <HeroCarousel />

        <InfoBanner text="Быстрая доставка по Душанбе: 30-45 минут" />

        <section>
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-lg font-bold">Трендовые товары</h3>
          </div>

          {isLoading ? <div className="stitch-card p-6 text-sm">Загружаем товары...</div> : null}
          {error ? <div className="rounded-xl bg-red-100 p-4 text-sm text-red-700">{error}</div> : null}

          {!isLoading && !error ? (
            <div className="grid grid-cols-2 gap-4">
              {medicines.map((medicine) => (
                <MedicineCard key={medicine.id} medicine={medicine} />
              ))}
            </div>
          ) : null}
        </section>
      </section>
    </AppShell>
  );
}
