"use client";

import { useEffect, useState } from "react";
import { getActivePharmacies, type ActivePharmacy } from "@/entities/pharmacy/api";

type Props = {
  onPharmacyClick: (pharmacy: ActivePharmacy) => void;
};

export function PharmacyBanners({ onPharmacyClick }: Props) {
  const [pharmacies, setPharmacies] = useState<ActivePharmacy[]>([]);
  const [isLoading, setIsLoading] = useState(true);

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
        <div className="flex gap-2 xs:gap-3 overflow-x-auto pb-2 scrollbar-hide scroll-touch -mx-1.5 px-1.5 xs:-mx-3 xs:px-3 sm:-mx-0 sm:px-0">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-24 xs:h-28 sm:h-32 w-[200px] xs:w-[240px] sm:w-[280px] flex-shrink-0 rounded-2xl bg-surface-container-low animate-pulse" />
          ))}
        </div>
      </section>
    );
  }

  if (pharmacies.length === 0) return null;

  return (
    <section>
      <h3 className="text-sm xs:text-base sm:text-lg font-bold mb-2">Аптеки</h3>
      <div className="flex gap-2 xs:gap-3 overflow-x-auto pb-2 scrollbar-hide scroll-touch -mx-1.5 px-1.5 xs:-mx-3 xs:px-3 sm:-mx-0 sm:px-0 snap-x">
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
      </div>
    </section>
  );
}
