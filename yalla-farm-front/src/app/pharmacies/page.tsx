"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { getActivePharmacies, type ActivePharmacy } from "@/entities/pharmacy/api";
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

function pharmacyBannerSrc(pharmacy: CityPharmacy): string | null {
  if (!pharmacy.bannerUrl) return null;
  if (pharmacy.bannerUrl.startsWith("http")) return pharmacy.bannerUrl;
  return `/api/pharmacies/banner/${pharmacy.id.replace(/^admin-/, "")}/content?w=800`;
}

function buildCityPharmacies(activePharmacies: ActivePharmacy[]): CityPharmacy[] {
  const items: CityPharmacy[] = DORU_DUSHANBE_ACTIVE_PHARMACIES.map((pharmacy) => {
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

  const knownByCoordinate = new Set(
    items.map((pharmacy) => `${pharmacy.title.toLowerCase()}|${pharmacy.lat.toFixed(5)}|${pharmacy.lng.toFixed(5)}`),
  );

  for (const pharmacy of activePharmacies) {
    if (pharmacy.isActive === false || pharmacy.latitude == null || pharmacy.longitude == null) continue;
    const lat = Number(pharmacy.latitude);
    const lng = Number(pharmacy.longitude);
    const coordinateKey = `${pharmacy.title.toLowerCase()}|${lat.toFixed(5)}|${lng.toFixed(5)}`;
    if (knownByCoordinate.has(coordinateKey)) continue;

    items.push({
      id: pharmacy.id,
      title: pharmacy.title,
      address: pharmacy.address,
      opensAt: pharmacy.opensAt ?? null,
      closesAt: pharmacy.closesAt ?? null,
      integrated: true,
      iconUrl: pharmacy.iconUrl ?? null,
      bannerUrl: pharmacy.bannerUrl ?? null,
      hasDelivery: Boolean(pharmacy.hasDelivery),
      fullTime: isFullTime(pharmacy.opensAt ?? null, pharmacy.closesAt ?? null),
      source: "admin",
      lat,
      lng,
    });
  }

  return items;
}

export default function PharmaciesPage() {
  const [activeTab, setActiveTab] = useState<Tab>("list");
  const [deliveryFilter, setDeliveryFilter] = useState<DeliveryFilter>("all");
  const [sortMode, setSortMode] = useState<SortMode>("full");
  const [activePharmacies, setActivePharmacies] = useState<ActivePharmacy[]>([]);
  const [selectedPharmacyId, setSelectedPharmacyId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const userCoords = useDeliveryAddressStore((state) => state.coords);

  useEffect(() => {
    const query = new URLSearchParams(window.location.search);
    if (query.get("tab") === "map") setActiveTab("map");
  }, []);

  useEffect(() => {
    setIsLoading(true);
    getActivePharmacies()
      .then((items) => setActivePharmacies(items.filter((pharmacy) => pharmacy.isActive !== false)))
      .catch((err) => setError(err instanceof Error ? err.message : "Не удалось загрузить аптеки."))
      .finally(() => setIsLoading(false));
  }, []);

  const pharmacies = useMemo(() => buildCityPharmacies(activePharmacies), [activePharmacies]);

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

          <div className="flex flex-col gap-2 rounded-2xl bg-surface-container-low p-2 sm:flex-row">
            <label className="flex flex-1 flex-col gap-1 text-xs font-bold text-on-surface-variant">
              Фильтр
              <select
                value={deliveryFilter}
                onChange={(event) => setDeliveryFilter(event.target.value as DeliveryFilter)}
                className="h-10 rounded-xl border border-outline bg-surface px-3 text-sm font-bold text-on-surface"
              >
                <option value="all">Все аптеки</option>
                <option value="delivery">Есть доставка</option>
              </select>
            </label>
            <label className="flex flex-1 flex-col gap-1 text-xs font-bold text-on-surface-variant">
              Сортировка
              <select
                value={sortMode}
                onChange={(event) => setSortMode(event.target.value as SortMode)}
                className="h-10 rounded-xl border border-outline bg-surface px-3 text-sm font-bold text-on-surface"
              >
                <option value="full">Сначала 24/7</option>
                <option value="title">По названию</option>
              </select>
            </label>
          </div>
        </section>

        {isLoading ? (
          <div className="rounded-3xl bg-surface-container-low p-6 text-sm font-semibold">Загружаем аптеки...</div>
        ) : null}
        {error ? (
          <div className="rounded-2xl bg-secondary/10 p-3 text-sm font-semibold text-secondary">{error}</div>
        ) : null}

        {activeTab === "list" ? (
          visiblePharmacies.length === 0 && !isLoading ? (
            <div className="rounded-3xl bg-surface-container-low p-8 text-center text-sm font-semibold text-on-surface-variant">
              По выбранному фильтру аптек нет.
            </div>
          ) : (
            <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {visiblePharmacies.map((pharmacy) => (
                <button
                  key={pharmacy.id}
                  type="button"
                  onClick={() => setSelectedPharmacyId(pharmacy.id)}
                  className="overflow-hidden rounded-2xl border border-outline/60 bg-surface text-left shadow-card transition active:scale-[0.99] hover:border-primary/40 hover:shadow-glass"
                >
                  <div className="relative h-28 overflow-hidden bg-primary-soft">
                    {pharmacyBannerSrc(pharmacy) ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={pharmacyBannerSrc(pharmacy)!} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" />
                    ) : (
                      <div className="absolute inset-0 bg-gradient-to-br from-primary-soft via-surface-container-low to-surface-container-high" />
                    )}
                    <div className="absolute left-3 top-3 flex flex-wrap gap-1.5">
                      {pharmacy.fullTime ? <span className="rounded-full bg-primary px-2 py-1 text-[10px] font-black text-white">24/7</span> : null}
                      {pharmacy.hasDelivery ? <span className="rounded-full bg-emerald-500 px-2 py-1 text-[10px] font-black text-white">Доставка</span> : null}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-3">
                    {pharmacy.source === "admin" ? (
                      <PharmacyLogo pharmacyId={pharmacy.id.replace(/^admin-/, "")} iconUrl={pharmacy.iconUrl} size={44} className="flex-shrink-0" />
                    ) : (
                      <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                        <Icon name="pharmacy" size={22} />
                      </span>
                    )}
                    <div className="min-w-0 flex-1">
                      <h2 className="truncate text-sm font-black text-on-surface">{pharmacy.title}</h2>
                      <p className="truncate text-xs text-on-surface-variant">{pharmacy.address}</p>
                      <p className="mt-1 text-[11px] font-bold text-primary">{pharmacyHoursLabel(pharmacy)}</p>
                    </div>
                  </div>
                </button>
              ))}
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
              <div className="relative h-32 bg-primary-soft">
                {pharmacyBannerSrc(selectedPharmacy) ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={pharmacyBannerSrc(selectedPharmacy)!} alt="" className="h-full w-full object-cover" />
                ) : (
                  <div className="absolute inset-0 bg-gradient-to-br from-primary-soft via-surface-container-low to-surface-container-high" />
                )}
                <button
                  type="button"
                  onClick={() => setSelectedPharmacyId(null)}
                  className="absolute right-3 top-3 flex h-10 w-10 items-center justify-center rounded-full bg-surface/90 text-on-surface shadow-card transition hover:bg-surface"
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
