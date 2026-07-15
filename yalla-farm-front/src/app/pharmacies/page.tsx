"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { DORU_DUSHANBE_ACTIVE_PHARMACIES } from "@/entities/pharmacy/doru-dushanbe-integrated";
import { useDeliveryAddressStore } from "@/features/delivery/model/deliveryAddressStore";
import { AppShell } from "@/widgets/layout/AppShell";
import { TopBar } from "@/widgets/layout/TopBar";
import { Icon, PharmacyLogo } from "@/shared/ui";
import type { PharmacyMarker } from "@/widgets/map/PharmacyMap";

const PharmacyMap = dynamic(() => import("@/widgets/map/PharmacyMap").then((m) => m.PharmacyMap), { ssr: false });

type Tab = "list" | "map";
type DeliveryFilter = "all" | "delivery";
type SortMode = "full" | "title";

type CityPharmacy = PharmacyMarker & {
  bannerUrl?: string | null;
  hasDelivery: boolean;
  fullTime: boolean;
  source: "doru" | "admin";
};

function formatPharmacyTime(value?: string | null): string {
  if (!value) return "Неизвестно";
  const [hours, minutes] = value.split(":");
  return hours && minutes ? `${hours}:${minutes}` : value;
}

function isFullTime(opensAt?: string | null, closesAt?: string | null): boolean {
  if (!opensAt && !closesAt) return true;
  const open = formatPharmacyTime(opensAt);
  const close = formatPharmacyTime(closesAt);
  return open === "00:00" && (close === "23:59" || close === "00:00");
}

function pharmacyHoursLabel(pharmacy: Pick<CityPharmacy, "opensAt" | "closesAt" | "fullTime">): string {
  if (pharmacy.fullTime) return "24/7";
  return `${formatPharmacyTime(pharmacy.opensAt)}-${formatPharmacyTime(pharmacy.closesAt)}`;
}

function buildCityPharmacies(): CityPharmacy[] {
  return DORU_DUSHANBE_ACTIVE_PHARMACIES.map((pharmacy) => {
    const fullTime = pharmacy.is24Time === 1 || isFullTime(pharmacy.opensAt ?? null, pharmacy.closesAt ?? null);
    return {
      id: `doru-${pharmacy.id}`,
      title: pharmacy.title,
      address: pharmacy.address,
      landmark: pharmacy.landmark ?? null,
      opensAt: pharmacy.opensAt ?? null,
      closesAt: pharmacy.closesAt ?? null,
      regionName: pharmacy.regionName ?? null,
      integrated: pharmacy.integrated,
      hasDelivery: Number(pharmacy.delivery ?? 0) > 0,
      fullTime,
      source: "doru",
      lat: pharmacy.lat,
      lng: pharmacy.lng,
    };
  });
}

export default function PharmaciesPage() {
  const [activeTab, setActiveTab] = useState<Tab>("list");
  const [deliveryFilter, setDeliveryFilter] = useState<DeliveryFilter>("all");
  const [sortMode, setSortMode] = useState<SortMode>("full");
  const [selectedPharmacyId, setSelectedPharmacyId] = useState<string | null>(null);
  const userCoords = useDeliveryAddressStore((state) => state.coords);

  useEffect(() => {
    const query = new URLSearchParams(window.location.search);
    if (query.get("tab") === "map") setActiveTab("map");
  }, []);

  const pharmacies = useMemo(() => buildCityPharmacies(), []);

  const visiblePharmacies = useMemo(() => {
    return pharmacies
      .filter((pharmacy) => deliveryFilter === "all" || pharmacy.hasDelivery)
      .sort((a, b) => {
        if (sortMode === "full" && a.fullTime !== b.fullTime) return a.fullTime ? -1 : 1;
        return a.title.localeCompare(b.title, "ru");
      });
  }, [pharmacies, deliveryFilter, sortMode]);

  const selectedPharmacy = selectedPharmacyId
    ? pharmacies.find((pharmacy) => pharmacy.id === selectedPharmacyId) ?? null
    : null;

  return (
    <AppShell hideFooter top={<TopBar title="Аптеки" backHref="back" />}>
      <div className="mx-auto max-w-6xl space-y-4">
        <section className="space-y-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h1 className="font-display text-2xl font-black text-on-surface sm:text-3xl">Аптеки Душанбе</h1>
              <p className="mt-1 text-sm text-on-surface-variant">Список аптек и карта для оформления заказов</p>
            </div>
            <span className="text-sm font-bold text-on-surface-variant">{visiblePharmacies.length} из {pharmacies.length}</span>
          </div>

          <div className="grid grid-cols-2 rounded-2xl bg-surface-container-low p-1">
            <button
              type="button"
              onClick={() => setActiveTab("list")}
              className={`rounded-xl px-3 py-2 text-sm font-bold transition ${
                activeTab === "list" ? "bg-surface text-on-surface shadow-card" : "text-on-surface-variant"
              }`}
            >
              Список
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("map")}
              className={`rounded-xl px-3 py-2 text-sm font-bold transition ${
                activeTab === "map" ? "bg-surface text-on-surface shadow-card" : "text-on-surface-variant"
              }`}
            >
              Карта
            </button>
          </div>

          <div className="grid gap-3 rounded-3xl border border-outline/60 bg-surface p-3 shadow-card sm:grid-cols-2">
            <div className="space-y-2">
              <p className="text-xs font-black uppercase text-on-surface-variant">Фильтр</p>
              <div className="grid grid-cols-2 rounded-2xl bg-surface-container-low p-1">
                <button
                  type="button"
                  onClick={() => setDeliveryFilter("all")}
                  className={`rounded-xl px-3 py-2 text-sm font-bold transition ${
                    deliveryFilter === "all" ? "bg-primary text-on-primary shadow-card" : "text-on-surface-variant hover:text-on-surface"
                  }`}
                >
                  Все
                </button>
                <button
                  type="button"
                  onClick={() => setDeliveryFilter("delivery")}
                  className={`rounded-xl px-3 py-2 text-sm font-bold transition ${
                    deliveryFilter === "delivery" ? "bg-primary text-on-primary shadow-card" : "text-on-surface-variant hover:text-on-surface"
                  }`}
                >
                  Доставка
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-xs font-black uppercase text-on-surface-variant">Сортировка</p>
              <div className="grid grid-cols-2 rounded-2xl bg-surface-container-low p-1">
                <button
                  type="button"
                  onClick={() => setSortMode("full")}
                  className={`rounded-xl px-3 py-2 text-sm font-bold transition ${
                    sortMode === "full" ? "bg-primary text-on-primary shadow-card" : "text-on-surface-variant hover:text-on-surface"
                  }`}
                >
                  24/7
                </button>
                <button
                  type="button"
                  onClick={() => setSortMode("title")}
                  className={`rounded-xl px-3 py-2 text-sm font-bold transition ${
                    sortMode === "title" ? "bg-primary text-on-primary shadow-card" : "text-on-surface-variant hover:text-on-surface"
                  }`}
                >
                  Название
                </button>
              </div>
            </div>
          </div>
        </section>

        {activeTab === "list" ? (
          visiblePharmacies.length === 0 ? (
            <div className="rounded-3xl bg-surface-container-low p-8 text-center text-sm font-semibold text-on-surface-variant">
              По выбранному фильтру аптек нет.
            </div>
          ) : (
            <section className="overflow-hidden rounded-3xl border border-outline/60 bg-surface shadow-card">
              <div className="hidden grid-cols-[minmax(220px,1.2fr)_minmax(220px,1fr)_120px_120px] gap-3 border-b border-outline/60 bg-surface-container-low px-4 py-3 text-xs font-black uppercase text-on-surface-variant md:grid">
                <span>Аптека</span>
                <span>Адрес</span>
                <span>Режим</span>
                <span>Доставка</span>
              </div>
              <div className="divide-y divide-outline/50">
                {visiblePharmacies.map((pharmacy) => (
                  <button
                    key={pharmacy.id}
                    type="button"
                    onClick={() => setSelectedPharmacyId(pharmacy.id)}
                    className="grid w-full gap-2 px-3 py-3 text-left transition hover:bg-primary-soft/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 md:grid-cols-[minmax(220px,1.2fr)_minmax(220px,1fr)_120px_120px] md:items-center md:gap-3 md:px-4"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      {pharmacy.source === "admin" ? (
                        <PharmacyLogo pharmacyId={pharmacy.id.replace(/^admin-/, "")} iconUrl={pharmacy.iconUrl} size={42} className="flex-shrink-0" />
                      ) : (
                        <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                          <Icon name="pharmacy" size={22} />
                        </span>
                      )}
                      <div className="min-w-0">
                        <h2 className="line-clamp-2 text-sm font-black leading-tight text-on-surface md:truncate">{pharmacy.title}</h2>
                        <p className="mt-1 text-[11px] font-bold text-primary md:hidden">{pharmacyHoursLabel(pharmacy)}</p>
                      </div>
                    </div>
                    <p className="min-w-0 line-clamp-2 text-xs font-semibold leading-snug text-on-surface-variant md:truncate md:text-sm">{pharmacy.address}</p>
                    <span className="hidden text-sm font-black text-primary md:block">{pharmacyHoursLabel(pharmacy)}</span>
                    <span className={`w-max rounded-full px-3 py-1 text-xs font-black ${
                      pharmacy.hasDelivery ? "bg-emerald-50 text-emerald-600" : "bg-surface-container-low text-on-surface-variant"
                    }`}>
                      {pharmacy.hasDelivery ? "Есть" : "Нет"}
                    </span>
                  </button>
                ))}
              </div>
            </section>
          )
        ) : (
          <section className="overflow-hidden rounded-3xl bg-surface-container-low shadow-card">
            <div className="h-[calc(100dvh-12rem)] min-h-[420px]">
              <PharmacyMap
                pharmacies={visiblePharmacies}
                userLocation={userCoords}
                initialZoom={12}
                clusterMarkers
                onPharmacyClick={setSelectedPharmacyId}
                className="h-full w-full"
              />
            </div>
          </section>
        )}

        {selectedPharmacy ? (
          <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/45 p-3 backdrop-blur-sm">
            <button
              type="button"
              className="absolute inset-0 cursor-default"
              onClick={() => setSelectedPharmacyId(null)}
              aria-label="Закрыть информацию об аптеке"
            />
            <div className="relative w-full max-w-lg overflow-hidden rounded-3xl bg-surface shadow-2xl">
              <div className="relative flex justify-end bg-surface-container-low p-3">
                <button
                  type="button"
                  onClick={() => setSelectedPharmacyId(null)}
                  className="flex h-10 w-10 items-center justify-center rounded-full bg-surface text-on-surface shadow-card transition hover:bg-surface-container-high"
                  aria-label="Закрыть"
                >
                  <Icon name="close" size={18} />
                </button>
              </div>
              <div className="space-y-3 p-4 sm:p-5">
                <div className="flex items-center gap-3">
                  {selectedPharmacy.source === "admin" ? (
                    <PharmacyLogo pharmacyId={selectedPharmacy.id.replace(/^admin-/, "")} iconUrl={selectedPharmacy.iconUrl} size={48} className="flex-shrink-0" />
                  ) : (
                    <span className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                      <Icon name="pharmacy" size={24} />
                    </span>
                  )}
                  <div className="min-w-0">
                    <h2 className="text-lg font-black leading-tight text-on-surface">{selectedPharmacy.title}</h2>
                    <p className="mt-1 text-xs font-bold text-primary">{selectedPharmacy.integrated ? "Интегрирована" : "Информационная карточка"}</p>
                  </div>
                </div>

                <InfoBlock label="Адрес" value={selectedPharmacy.address} />
                {selectedPharmacy.landmark ? <InfoBlock label="Ориентир" value={selectedPharmacy.landmark} /> : null}
                {selectedPharmacy.regionName ? <InfoBlock label="Район" value={selectedPharmacy.regionName} /> : null}
                <div className="grid grid-cols-2 gap-2">
                  <InfoBlock label="Открытие" value={selectedPharmacy.fullTime ? "24/7" : formatPharmacyTime(selectedPharmacy.opensAt)} />
                  <InfoBlock label="Закрытие" value={selectedPharmacy.fullTime ? "24/7" : formatPharmacyTime(selectedPharmacy.closesAt)} />
                </div>
                <InfoBlock label="Координаты" value={`${selectedPharmacy.lat.toFixed(6)}, ${selectedPharmacy.lng.toFixed(6)}`} />
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </AppShell>
  );
}

function InfoBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-surface-container-low p-3">
      <p className="text-[10px] font-bold uppercase tracking-wide text-on-surface-variant">{label}</p>
      <p className="mt-1 text-sm font-semibold leading-relaxed text-on-surface">{value}</p>
    </div>
  );
}
