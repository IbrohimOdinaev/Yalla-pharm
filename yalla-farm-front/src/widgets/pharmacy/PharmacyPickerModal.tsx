"use client";

import { useEffect, useState } from "react";
import { getActivePharmacies, type ActivePharmacy } from "@/entities/pharmacy/api";
import { usePharmacyStore } from "@/features/pharmacy/model/pharmacyStore";

type Props = {
  open: boolean;
  onClose: () => void;
};

export function PharmacyPickerModal({ open, onClose }: Props) {
  const [pharmacies, setPharmacies] = useState<ActivePharmacy[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const selectedPharmacy = usePharmacyStore((s) => s.selectedPharmacy);
  const setPharmacy = usePharmacyStore((s) => s.setPharmacy);

  useEffect(() => {
    if (!open) return;
    setIsLoading(true);
    getActivePharmacies()
      .then(setPharmacies)
      .catch(() => setPharmacies([]))
      .finally(() => setIsLoading(false));
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  function onSelect(pharmacy: ActivePharmacy | null) {
    if (pharmacy) {
      setPharmacy({ id: pharmacy.id, title: pharmacy.title, iconUrl: pharmacy.iconUrl });
    } else {
      setPharmacy(null);
    }
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      <div
        className="relative w-full max-w-lg max-h-[80vh] overflow-y-auto bg-surface rounded-2xl shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-surface-container-high sticky top-0 bg-surface z-10">
          <h2 className="text-base font-bold">Выберите аптеку</h2>
          <button
            type="button"
            onClick={onClose}
            className="flex items-center justify-center w-8 h-8 rounded-full bg-surface-container-low hover:bg-surface-container-high transition"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center p-8">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        ) : (
          <div className="p-3 space-y-2">
            {/* All pharmacies option */}
            <button
              type="button"
              onClick={() => onSelect(null)}
              className={`w-full flex items-center gap-3 rounded-xl p-3 transition ${
                !selectedPharmacy ? "bg-primary/10 ring-2 ring-primary" : "hover:bg-surface-container-low"
              }`}
            >
              <div className="w-10 h-10 rounded-full bg-surface-container-high flex items-center justify-center flex-shrink-0">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="text-on-surface-variant">
                  <circle cx="12" cy="12" r="10" /><path d="M2 12h20" /><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                </svg>
              </div>
              <div className="text-left">
                <p className="text-sm font-bold">Все аптеки</p>
                <p className="text-xs text-on-surface-variant">Показать товары из всех аптек</p>
              </div>
            </button>

            {/* Pharmacy list */}
            {pharmacies.map((pharmacy) => {
              const isSelected = selectedPharmacy?.id === pharmacy.id;
              return (
                <button
                  key={pharmacy.id}
                  type="button"
                  onClick={() => onSelect(pharmacy)}
                  className={`w-full rounded-xl overflow-hidden transition ${
                    isSelected ? "ring-2 ring-primary" : "hover:bg-surface-container-low"
                  }`}
                >
                  {/* Banner */}
                  {pharmacy.bannerUrl ? (
                    <div className="h-24 w-full overflow-hidden bg-surface-container">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={pharmacy.bannerUrl.startsWith("http") ? pharmacy.bannerUrl : `/api/pharmacies/icon/${pharmacy.id}/content`}
                        alt=""
                        className="w-full h-full object-cover"
                        onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                      />
                    </div>
                  ) : null}

                  {/* Info row */}
                  <div className={`flex items-center gap-3 p-3 ${isSelected ? "bg-primary/5" : ""}`}>
                    <div className="w-10 h-10 rounded-full overflow-hidden bg-primary/10 flex items-center justify-center flex-shrink-0">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={pharmacy.iconUrl?.startsWith("http") ? pharmacy.iconUrl : `/api/pharmacies/icon/${pharmacy.id}/content`}
                        alt=""
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = "none";
                          (e.target as HTMLImageElement).nextElementSibling?.removeAttribute("style");
                        }}
                      />
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="text-primary" style={{ display: "none" }}>
                        <path d="M12 2v4M12 18v4M2 12h4M18 12h4" />
                      </svg>
                    </div>
                    <div className="text-left flex-1 min-w-0">
                      <p className="text-sm font-bold truncate">{pharmacy.title}</p>
                      <p className="text-xs text-on-surface-variant truncate">{pharmacy.address}</p>
                    </div>
                    {isSelected ? (
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-primary flex-shrink-0">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    ) : null}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
