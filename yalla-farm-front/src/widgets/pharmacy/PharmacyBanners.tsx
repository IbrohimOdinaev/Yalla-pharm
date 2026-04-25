"use client";

import { useEffect, useState } from "react";
import { getActivePharmacies, type ActivePharmacy } from "@/entities/pharmacy/api";
import { usePharmacyStore } from "@/features/pharmacy/model/pharmacyStore";

type Props = {
  onPharmacyClick: (pharmacy: ActivePharmacy) => void;
};

export function PharmacyBanners({ onPharmacyClick }: Props) {
  const [pharmacies, setPharmacies] = useState<ActivePharmacy[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const selectedPharmacy = usePharmacyStore((s) => s.selectedPharmacy);
  const openPicker = usePharmacyStore((s) => s.openPicker);

  useEffect(() => {
    getActivePharmacies()
      .then((p) => setPharmacies(p.filter((x) => x.bannerUrl)))
      .catch(() => setPharmacies([]))
      .finally(() => setIsLoading(false));
  }, []);

  if (isLoading) {
    return (
      <section>
        <h3 className="text-sm xs:text-base sm:text-lg font-bold mb-2">Аптеки</h3>
        <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide scroll-touch">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-24 xs:h-28 sm:h-32 w-[200px] xs:w-[240px] sm:w-[280px] flex-shrink-0 rounded-2xl bg-surface-container-low animate-pulse" />
          ))}
        </div>
      </section>
    );
  }

  return (
    <section>
      <h3 className="text-sm xs:text-base sm:text-lg font-bold mb-2">Аптеки</h3>
      <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide scroll-touch snap-x snap-mandatory">
        {pharmacies.map((p) => {
          const bannerSrc = p.bannerUrl?.startsWith("http")
            ? p.bannerUrl
            : `/api/pharmacies/banner/${p.id}/content`;
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => onPharmacyClick(p)}
              className="relative h-24 xs:h-28 sm:h-32 w-[200px] xs:w-[240px] sm:w-[280px] flex-shrink-0 rounded-2xl overflow-hidden snap-start group transition active:scale-95 shadow-card hover:shadow-glass"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={bannerSrc}
                alt={p.title}
                className="absolute inset-0 w-full h-full object-cover"
                onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
              <div className="absolute bottom-0 left-0 right-0 p-2 xs:p-3 text-left">
                <p className="text-xs xs:text-sm font-bold text-white drop-shadow truncate">{p.title}</p>
                {p.address ? (
                  <p className="text-[10px] xs:text-xs text-white/80 truncate">{p.address}</p>
                ) : null}
              </div>
            </button>
          );
        })}

        {/* Pharmacy picker entry — always last. Opens the full picker modal. */}
        <button
          type="button"
          onClick={openPicker}
          className="relative h-24 xs:h-28 sm:h-32 w-[200px] xs:w-[240px] sm:w-[280px] flex-shrink-0 rounded-2xl overflow-hidden snap-start flex flex-col items-center justify-center gap-1.5 bg-primary-soft text-primary transition active:scale-95 shadow-card hover:shadow-glass"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/15">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="7" height="7" rx="1.5" />
              <rect x="14" y="3" width="7" height="7" rx="1.5" />
              <rect x="3" y="14" width="7" height="7" rx="1.5" />
              <rect x="14" y="14" width="7" height="7" rx="1.5" />
            </svg>
          </div>
          <p className="text-sm font-bold">
            {selectedPharmacy ? selectedPharmacy.title : "Все аптеки"}
          </p>
          <p className="text-[11px] font-semibold text-primary/80">
            {selectedPharmacy ? "Изменить" : "Выбрать аптеку"}
          </p>
        </button>
      </div>
    </section>
  );
}
