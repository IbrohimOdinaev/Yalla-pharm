"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useSearchParams, useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import Image from "next/image";
import { replaceLastNavigation } from "@/shared/lib/useNavigationHistory";
import { getCatalogMedicinesPaginated, getHomePopularMedicines, searchByPharmacy, liveSearch, type LiveSearchSuggestion } from "@/entities/medicine/api";
import { getCategories } from "@/entities/category/api";
import type { ApiMedicine, ApiCategory, ApiPharmacyMedicinesGroup } from "@/shared/types/api";
import { MedicineCard } from "@/widgets/catalog/MedicineCard";
import { MedicineCardSkeleton } from "@/widgets/catalog/MedicineCardSkeleton";
import { MedicineRail } from "@/widgets/catalog/MedicineRail";
import Link from "next/link";
import { CategoryTile, type CategoryTilePalette } from "@/widgets/catalog/CategoryTile";
import { type CategoryIconKey } from "@/widgets/catalog/CategoryIcon";
import { AppShell } from "@/widgets/layout/AppShell";

import { useAppSelector } from "@/shared/lib/redux";

import { useDeliveryAddressStore } from "@/features/delivery/model/deliveryAddressStore";
import { usePharmacyStore } from "@/features/pharmacy/model/pharmacyStore";
import { AddressPickerModal } from "@/widgets/address/AddressPickerModal";
import { getActivePharmacies, type ActivePharmacy } from "@/entities/pharmacy/api";
import { DORU_DUSHANBE_ACTIVE_PHARMACIES } from "@/entities/pharmacy/doru-dushanbe-integrated";
import { PharmacyLogo } from "@/shared/ui";
import type { GeoPoint } from "@/shared/lib/map";
import type { PharmacyMarker } from "@/widgets/map/PharmacyMap";

const PharmacyMap = dynamic(() => import("@/widgets/map/PharmacyMap").then((m) => m.PharmacyMap), { ssr: false });

const POPULAR_QUERIES = ["Парацетамол", "Ибупрофен", "Амоксициллин", "Цитрамон", "Лоратадин", "Омепразол"];
const ADDRESS_PROMPT_DISMISSED_KEY = "yalla.delivery.addressPromptDismissed";
const ADDRESS_PROMPT_DISMISSED_COOKIE = "yalla_address_prompt_dismissed";

type QuickCategory = {
  icon: CategoryIconKey;
  palette: CategoryTilePalette;
  label: string;
  keywords?: string[];
  /** Optional photo (in `public/categories/`) shown instead of the SVG icon. */
  image?: string;
};

// Home-feed rails. Each rail resolves its server-side categoryId by matching
// one of the keywords against the category name — this keeps us working no
// matter how backend renames a category as long as the core word survives.
// `keywords: null` means "no category filter" → generic "Popular" rail.
type RailSpec = {
  id: string;
  title: string;
  accent: "primary" | "secondary" | "tertiary" | "accent";
  keywords: string[] | null;
};

const HOME_RAILS: RailSpec[] = [
  { id: "popular", title: "Популярные товары", accent: "accent", keywords: null },
  { id: "pain", title: "Боль и жар", accent: "secondary", keywords: ["боль", "жар", "температур", "обезболив", "анальг"] },
  { id: "vitamins", title: "Витамины и БАД", accent: "accent", keywords: ["витамин", "бад", "биодобав"] },
  { id: "cold", title: "Простуда и дыхание", accent: "tertiary", keywords: ["дыхат", "респират", "кашел", "бронх", "простуд", "грипп", "орви"] },
  { id: "allergy", title: "Аллергия", accent: "secondary", keywords: ["аллерг", "антигистамин"] },
  { id: "gi", title: "ЖКТ и пищеварение", accent: "primary", keywords: ["жкт", "желуд", "кишеч", "пищевар", "гастро", "печен"] },
  { id: "heart", title: "Сердце и давление", accent: "secondary", keywords: ["серд", "сосуд", "кардио", "давлен", "гиперт"] },
  { id: "baby", title: "Мама и малыш", accent: "primary", keywords: ["дет", "малыш", "младен", "мама", "беремен", "памперс", "подгузн"] },
];

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("Request timed out")), timeoutMs);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

async function getFastPopularMedicines(pharmacyId?: string) {
  try {
    return await withTimeout(getHomePopularMedicines(10, pharmacyId), 1200);
  } catch {
    return {
      page: 1,
      pageSize: 0,
      totalCount: 0,
      medicines: [],
    };
  }
}

function hasDismissedAddressPrompt() {
  if (typeof window === "undefined") return false;
  if (localStorage.getItem(ADDRESS_PROMPT_DISMISSED_KEY) === "1") return true;
  return document.cookie
    .split(";")
    .some((part) => part.trim() === `${ADDRESS_PROMPT_DISMISSED_COOKIE}=1`);
}

function rememberAddressPromptDismissal() {
  if (typeof window === "undefined") return;
  localStorage.setItem(ADDRESS_PROMPT_DISMISSED_KEY, "1");
  document.cookie = `${ADDRESS_PROMPT_DISMISSED_COOKIE}=1; Max-Age=31536000; Path=/; SameSite=Lax`;
}

const QUICK_CATEGORIES: QuickCategory[] = [
  { icon: "thermometer", palette: "coral", label: "Боль и жар", image: "/categories/hd/pain.png", keywords: ["боль", "жар", "температур", "обезболив", "анальг"] },
  { icon: "allergy", palette: "rose", label: "Аллергия", image: "/categories/hd/allergy.png", keywords: ["аллерг", "антигистамин"] },
  { icon: "lungs", palette: "sky", label: "Дыхание", image: "/categories/hd/respiratory.png", keywords: ["дыхат", "респират", "кашел", "бронх", "лёгк", "легк", "горл"] },
  { icon: "vitamin", palette: "sun", label: "Витамины", image: "/categories/hd/vitamins.png", keywords: ["витамин", "бад", "биодобав", "минерал"] },
  { icon: "heart", palette: "rose", label: "Сердце", image: "/categories/hd/heart.png", keywords: ["сердц", "сердеч", "кардио", "сосуд", "давлен"] },
  { icon: "eye", palette: "sky", label: "Глаза", image: "/categories/hd/eyes.png", keywords: ["глаз", "зрени", "офтальм", "капли"] },
  { icon: "moon", palette: "lilac", label: "Нервы и сон", image: "/categories/hd/sleep.png", keywords: ["невр", "психи", "нерв", "сон", "снотв", "успок", "стресс", "антидепресс", "седат"] },
  { icon: "shield", palette: "sage", label: "Иммунитет", image: "/categories/hd/immunity.png", keywords: ["иммун", "противовирус", "интерферон", "защит"] },
  { icon: "grid", palette: "mint", label: "Все категории", image: "/categories/hd/all.png" },
];

export default function HomePage() {
  return (
    <Suspense fallback={<HomeFallback />}>
      <HomeContent />
    </Suspense>
  );
}

function formatPharmacyTime(value?: string | null): string {
  if (!value) return "Неизвестно";
  const [hours, minutes] = value.split(":");
  return hours && minutes ? `${hours}:${minutes}` : value;
}

function pharmacyHoursLabel(pharmacy: { opensAt?: string | null; closesAt?: string | null }): string {
  if (!pharmacy.opensAt && !pharmacy.closesAt) return "Круглосуточно";
  return `${formatPharmacyTime(pharmacy.opensAt)}-${formatPharmacyTime(pharmacy.closesAt)}`;
}

type DushanbeMapPharmacy = {
  id: string;
  title: string;
  address: string;
  landmark?: string | null;
  phone?: string | null;
  opensAt?: string | null;
  closesAt?: string | null;
  regionName?: string | null;
  updatedAt?: string | null;
  status?: string | null;
  lastSync?: string | null;
  delivery?: number | null;
  foundItemsInCheck?: number | null;
  checkItemsTotal?: number | null;
  integrated: boolean;
  bannerUrl?: string | null;
  lat: number;
  lng: number;
};

function buildDushanbeMapPharmacies(activePharmacies: ActivePharmacy[]): DushanbeMapPharmacy[] {
  const items: DushanbeMapPharmacy[] = DORU_DUSHANBE_ACTIVE_PHARMACIES.map((pharmacy) => ({
    id: `doru-${pharmacy.id}`,
    title: pharmacy.title,
    address: pharmacy.address,
    landmark: pharmacy.landmark ?? null,
    phone: pharmacy.pharmacyPhone || pharmacy.phone || null,
    opensAt: pharmacy.opensAt ?? null,
    closesAt: pharmacy.closesAt ?? null,
    regionName: pharmacy.regionName ?? null,
    updatedAt: pharmacy.updatedAt ?? null,
    status: pharmacy.status ?? null,
    lastSync: pharmacy.lastSync ?? null,
    delivery: pharmacy.delivery ?? null,
    foundItemsInCheck: pharmacy.foundItemsInCheck ?? null,
    checkItemsTotal: pharmacy.checkItemsTotal ?? null,
    integrated: pharmacy.integrated,
    lat: pharmacy.lat,
    lng: pharmacy.lng,
  }));

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
      id: `admin-${pharmacy.id}`,
      title: pharmacy.title,
      address: pharmacy.address,
      phone: null,
      opensAt: pharmacy.opensAt ?? null,
      closesAt: pharmacy.closesAt ?? null,
      integrated: true,
      bannerUrl: pharmacy.bannerUrl ?? (pharmacy.id ? `/api/pharmacies/banner/${pharmacy.id}/content?w=720` : null),
      lat,
      lng,
    });
  }

  return items;
}

function PharmacyIntegrationBanner() {
  return (
    <section className="overflow-hidden rounded-3xl border border-outline/60 bg-surface-container-low shadow-card">
      <Link
        href="/for-pharmacies"
        className="group grid min-h-[220px] grid-cols-1 transition active:scale-[0.99] sm:min-h-[260px] lg:grid-cols-[minmax(0,0.9fr)_minmax(420px,1.1fr)]"
      >
        <div className="relative z-10 flex flex-col justify-between gap-5 p-5 sm:p-7 lg:p-8">
          <div>
            <h2 className="max-w-xl font-display text-2xl font-black leading-tight text-on-surface sm:text-3xl lg:text-4xl">
              Подключите аптеку к Yalla Pharm
            </h2>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <span className="inline-flex h-11 items-center justify-center rounded-full bg-primary px-5 text-sm font-black text-on-primary transition group-hover:bg-primary-container">
              Оставить заявку
            </span>
            <span className="inline-flex items-center gap-2 rounded-full bg-primary-soft px-3 py-1 text-xs font-black text-primary">
              <span className="h-2 w-2 rounded-full bg-secondary" />
              Для аптек Душанбе
            </span>
          </div>
        </div>

        <div className="relative min-h-[170px] overflow-hidden sm:min-h-[220px] lg:min-h-full">
          <Image
            src="/pharmacy-integration-banner.png"
            alt="Фармацевт работает с цифровым каталогом аптеки на планшете"
            fill
            priority
            unoptimized
            sizes="(min-width: 1024px) 58vw, 100vw"
            className="object-cover object-center transition duration-500 group-hover:scale-[1.03]"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-transparent lg:bg-gradient-to-r lg:from-surface-container-low lg:via-transparent lg:to-transparent" />
        </div>
      </Link>
    </section>
  );
}

function PharmaciesEntryBlock() {
  const [bannerPharmacies, setBannerPharmacies] = useState<ActivePharmacy[]>([]);

  useEffect(() => {
    let cancelled = false;
    getActivePharmacies()
      .then((items) => {
        if (cancelled) return;
        setBannerPharmacies(
          items
            .filter((pharmacy) => pharmacy.isActive !== false && Boolean(pharmacy.bannerUrl))
            .slice(0, 3),
        );
      })
      .catch(() => {
        if (!cancelled) setBannerPharmacies([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section>
      <h3 className="mb-2 text-sm font-bold text-on-surface xs:text-base sm:text-lg">Аптеки</h3>
      <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide scroll-touch">
        <Link
          href="/pharmacies"
          className="flex h-32 w-[280px] flex-shrink-0 flex-col items-center justify-center gap-1.5 rounded-2xl bg-primary-soft text-primary shadow-card transition active:scale-95 hover:bg-primary/15 hover:shadow-glass focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
        >
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/15">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <rect x="3" y="3" width="7" height="7" rx="1.5" />
              <rect x="14" y="3" width="7" height="7" rx="1.5" />
              <rect x="3" y="14" width="7" height="7" rx="1.5" />
              <rect x="14" y="14" width="7" height="7" rx="1.5" />
            </svg>
          </span>
          <span className="text-sm font-bold">Все аптеки</span>
          <span className="text-[11px] font-semibold text-primary/80">Выбрать аптеку</span>
        </Link>

        {bannerPharmacies.map((pharmacy) => {
          const isExternal = pharmacy.bannerUrl?.startsWith("http") ?? false;
          const bannerSrc = isExternal
            ? pharmacy.bannerUrl!
            : `/api/pharmacies/banner/${pharmacy.id}/content?w=480`;
          const bannerSrcSet = isExternal
            ? undefined
            : `/api/pharmacies/banner/${pharmacy.id}/content?w=480 1x, /api/pharmacies/banner/${pharmacy.id}/content?w=800 2x`;

          return (
            <Link
              key={pharmacy.id}
              href="/pharmacies"
              className="group relative h-32 w-[280px] flex-shrink-0 overflow-hidden rounded-2xl shadow-card transition active:scale-95 hover:shadow-glass focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={bannerSrc}
                srcSet={bannerSrcSet}
                alt={pharmacy.title}
                loading="lazy"
                decoding="async"
                className="absolute inset-0 h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/25 to-transparent" />
              <div className="absolute inset-x-0 bottom-0 p-3 text-left">
                <p className="truncate text-sm font-black text-white drop-shadow">{pharmacy.title}</p>
                {pharmacy.address ? (
                  <p className="mt-0.5 truncate text-xs font-semibold text-white/85">{pharmacy.address}</p>
                ) : null}
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}

function DushanbePharmacyMapModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [userLocation, setUserLocation] = useState<GeoPoint | null>(null);
  const [geoStatus, setGeoStatus] = useState<string>("Запрашиваем доступ к геолокации...");
  const [selectedPharmacyId, setSelectedPharmacyId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"list" | "map">("list");
  const [activePharmacies, setActivePharmacies] = useState<ActivePharmacy[]>([]);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const mapPharmacies = useMemo(
    () => buildDushanbeMapPharmacies(activePharmacies),
    [activePharmacies],
  );

  const pharmacies = useMemo<PharmacyMarker[]>(
    () => mapPharmacies
      .map((pharmacy) => ({
        id: pharmacy.id,
        title: pharmacy.title,
        address: pharmacy.address,
        landmark: pharmacy.landmark,
        phone: pharmacy.phone,
        opensAt: pharmacy.opensAt,
        closesAt: pharmacy.closesAt,
        regionName: pharmacy.regionName,
        updatedAt: pharmacy.updatedAt,
        status: pharmacy.status,
        lastSync: pharmacy.lastSync,
        delivery: pharmacy.delivery,
        foundItemsInCheck: pharmacy.foundItemsInCheck,
        checkItemsTotal: pharmacy.checkItemsTotal,
        integrated: pharmacy.integrated,
        lat: pharmacy.lat,
        lng: pharmacy.lng,
      })),
    [mapPharmacies],
  );

  const selectedPharmacy = useMemo(
    () => {
      if (!selectedPharmacyId) return null;
      return mapPharmacies.find((pharmacy) => pharmacy.id === selectedPharmacyId) ?? null;
    },
    [mapPharmacies, selectedPharmacyId],
  );

  useEffect(() => {
    if (!open) return;
    const scrollY = window.scrollY;
    const previousHtmlOverflow = document.documentElement.style.overflow;
    const previousBodyOverflow = document.body.style.overflow;
    const previousBodyPosition = document.body.style.position;
    const previousBodyTop = document.body.style.top;
    const previousBodyWidth = document.body.style.width;
    const previousBodyPaddingRight = document.body.style.paddingRight;
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
    document.documentElement.style.overflow = "hidden";
    document.body.style.overflow = "hidden";
    document.body.style.position = "fixed";
    document.body.style.top = `-${scrollY}px`;
    document.body.style.width = "100%";
    if (scrollbarWidth > 0) {
      document.body.style.paddingRight = `${scrollbarWidth}px`;
    }

    return () => {
      document.documentElement.style.overflow = previousHtmlOverflow;
      document.body.style.overflow = previousBodyOverflow;
      document.body.style.position = previousBodyPosition;
      document.body.style.top = previousBodyTop;
      document.body.style.width = previousBodyWidth;
      document.body.style.paddingRight = previousBodyPaddingRight;
      window.scrollTo(0, scrollY);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    setGeoStatus("Запрашиваем доступ к геолокации...");
    setSelectedPharmacyId(null);
    setActiveTab("list");

    getActivePharmacies()
      .then((items) => {
        setActivePharmacies(items.filter((pharmacy) => pharmacy.isActive !== false));
      })
      .catch(() => setActivePharmacies([]));

    if (!navigator.geolocation) {
      setGeoStatus("Геолокация недоступна в этом браузере.");
      return;
    }

    let isActive = true;
    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        if (!isActive) return;
        setUserLocation({ lat: position.coords.latitude, lng: position.coords.longitude });
        setGeoStatus("Ваше местоположение обновляется на карте.");
      },
      (error) => {
        if (!isActive) return;
        if (error.code === error.PERMISSION_DENIED) {
          setGeoStatus("Доступ к геолокации заблокирован в браузере.");
        } else {
          setGeoStatus("Не удалось получить текущее местоположение.");
        }
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 },
    );

    return () => {
      isActive = false;
      navigator.geolocation.clearWatch(watchId);
    };
  }, [open]);

  if (!open || !mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-[120] flex items-center justify-center overflow-hidden bg-black/50 p-3 backdrop-blur-sm sm:p-4">
      <div
        className="relative flex h-[calc(100dvh-1.5rem)] max-h-[780px] w-full max-w-[440px] flex-col overflow-hidden rounded-3xl bg-surface shadow-2xl sm:h-[86dvh] sm:max-w-6xl"
        role="dialog"
        aria-modal="true"
        aria-label="Карта аптек Душанбе"
      >
        <header className="flex flex-shrink-0 flex-col gap-3 border-b border-outline/60 px-4 py-3 sm:px-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="truncate text-base font-bold text-on-surface sm:text-lg">Аптеки Душанбе</h2>
              <p className="truncate text-xs text-on-surface-variant">
                Аптеки для оформления заказов · {geoStatus}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-surface-container text-on-surface transition active:scale-95 hover:bg-surface-container-high"
              aria-label="Закрыть"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
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
        </header>

        <div className="relative min-h-0 flex-1">
          {activeTab === "list" ? (
            <div className="h-full overflow-y-auto px-4 py-4 sm:px-5">
              {mapPharmacies.length === 0 ? (
                <div className="rounded-3xl bg-surface-container-low p-6 text-center text-sm font-semibold text-on-surface-variant">
                  Аптеки для заказа пока недоступны.
                </div>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {mapPharmacies.map((pharmacy) => {
                    const banner = pharmacy.bannerUrl || "";
                    return (
                      <button
                        key={pharmacy.id}
                        type="button"
                        onClick={() => setSelectedPharmacyId(pharmacy.id)}
                        className="overflow-hidden rounded-3xl border border-outline/60 bg-surface text-left shadow-card transition active:scale-[0.99] hover:border-primary/40 hover:shadow-glass"
                      >
                        <div className="relative h-24 overflow-hidden bg-primary-soft">
                          {banner ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={banner} alt="" className="h-full w-full object-cover" loading="lazy" decoding="async" />
                          ) : (
                            <>
                              <div className="absolute -right-8 -top-10 h-28 w-28 rounded-full bg-primary/10" />
                              <div className="absolute -bottom-12 left-12 h-24 w-24 rounded-full bg-tertiary/10" />
                            </>
                          )}
                          {pharmacy.integrated ? (
                            <span className="absolute left-3 top-3 rounded-full bg-emerald-500 px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-white">
                              Интегрирована
                            </span>
                          ) : null}
                          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/55 to-transparent px-4 py-3">
                            <p className="line-clamp-2 text-lg font-extrabold leading-tight text-white">{pharmacy.title}</p>
                          </div>
                        </div>
                        <div className="space-y-2 p-4">
                          <p className="line-clamp-2 text-sm font-semibold leading-snug text-on-surface">{pharmacy.address}</p>
                          <div className="flex flex-wrap gap-2 pt-1 text-[11px] font-bold">
                            <span className="rounded-full bg-surface-container-low px-2.5 py-1 text-on-surface-variant">
                              {pharmacyHoursLabel(pharmacy)}
                            </span>
                            {pharmacy.phone ? (
                              <span className="rounded-full bg-primary-soft px-2.5 py-1 text-primary">
                                {pharmacy.phone}
                              </span>
                            ) : null}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          ) : (
            <PharmacyMap
              pharmacies={pharmacies}
              userLocation={userLocation}
              initialZoom={12}
              clusterMarkers
              onPharmacyClick={setSelectedPharmacyId}
              className="h-full w-full"
            />
          )}

          {selectedPharmacy ? (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/20 p-3 backdrop-blur-[1px] sm:p-5">
              <button
                type="button"
                className="absolute inset-0 cursor-default"
                onClick={() => setSelectedPharmacyId(null)}
                aria-label="Закрыть информацию об аптеке"
              />
              <div
                className="relative w-full max-w-md overflow-hidden rounded-3xl bg-surface shadow-2xl"
                role="dialog"
                aria-modal="true"
                aria-label={`Информация об аптеке ${selectedPharmacy.title}`}
              >
                <div className="flex items-start justify-between gap-3 border-b border-outline/60 px-4 py-3 sm:px-5">
                  <div className="min-w-0">
                    {selectedPharmacy.integrated ? (
                      <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-emerald-700">
                        Интегрирована
                      </span>
                    ) : (
                      <span className="rounded-full bg-surface-container-low px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-on-surface-variant">
                        Активная
                      </span>
                    )}
                    <h3 className="mt-1 text-lg font-extrabold leading-tight text-on-surface">{selectedPharmacy.title}</h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedPharmacyId(null)}
                    className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-surface-container text-on-surface transition active:scale-95 hover:bg-surface-container-high"
                    aria-label="Закрыть"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                </div>

                <div className="space-y-3 px-4 py-4 sm:px-5">
                  <div className="rounded-2xl bg-surface-container-low p-3">
                    <p className="text-[10px] font-bold uppercase tracking-wide text-on-surface-variant">Адрес</p>
                    <p className="mt-1 text-sm font-semibold leading-relaxed text-on-surface">{selectedPharmacy.address}</p>
                  </div>

                  {selectedPharmacy.landmark ? (
                    <div className="rounded-2xl bg-surface-container-low p-3">
                      <p className="text-[10px] font-bold uppercase tracking-wide text-on-surface-variant">Ориентир</p>
                      <p className="mt-1 text-sm font-semibold leading-relaxed text-on-surface">{selectedPharmacy.landmark}</p>
                    </div>
                  ) : null}

                  <div className="grid grid-cols-2 gap-2">
                    <div className="rounded-2xl bg-surface-container-low p-3">
                      <p className="text-[10px] font-bold uppercase tracking-wide text-on-surface-variant">Открытие</p>
                      <p className="mt-1 text-sm font-bold text-on-surface">{formatPharmacyTime(selectedPharmacy.opensAt)}</p>
                    </div>
                    <div className="rounded-2xl bg-surface-container-low p-3">
                      <p className="text-[10px] font-bold uppercase tracking-wide text-on-surface-variant">Закрытие</p>
                      <p className="mt-1 text-sm font-bold text-on-surface">{formatPharmacyTime(selectedPharmacy.closesAt)}</p>
                    </div>
                  </div>

                  <div className="rounded-2xl bg-surface-container-low p-3">
                    <p className="text-[10px] font-bold uppercase tracking-wide text-on-surface-variant">Телефон аптеки</p>
                    <p className="mt-1 text-sm font-bold text-on-surface">{selectedPharmacy.phone || "Неизвестно"}</p>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div className="rounded-2xl bg-surface-container-low p-3">
                      <p className="text-[10px] font-bold uppercase tracking-wide text-on-surface-variant">Синхронизация</p>
                      <p className="mt-1 text-sm font-bold text-on-surface">{selectedPharmacy.lastSync || "Нет данных"}</p>
                    </div>
                    <div className="rounded-2xl bg-surface-container-low p-3">
                      <p className="text-[10px] font-bold uppercase tracking-wide text-on-surface-variant">Доставка</p>
                      <p className="mt-1 text-sm font-bold text-on-surface">{selectedPharmacy.delivery ?? 0}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div className="rounded-2xl bg-surface-container-low p-3">
                      <p className="text-[10px] font-bold uppercase tracking-wide text-on-surface-variant">Товаров в проверке</p>
                      <p className="mt-1 text-sm font-bold text-on-surface">{selectedPharmacy.foundItemsInCheck ?? 0}</p>
                    </div>
                    <div className="rounded-2xl bg-surface-container-low p-3">
                      <p className="text-[10px] font-bold uppercase tracking-wide text-on-surface-variant">Сумма проверки</p>
                      <p className="mt-1 text-sm font-bold text-on-surface">{selectedPharmacy.checkItemsTotal ?? 0}</p>
                    </div>
                  </div>

                  <div className="rounded-2xl bg-surface-container-low p-3">
                    <p className="text-[10px] font-bold uppercase tracking-wide text-on-surface-variant">Статус и обновление</p>
                    <p className="mt-1 text-sm font-bold text-on-surface">
                      {[selectedPharmacy.status, selectedPharmacy.updatedAt].filter(Boolean).join(" · ") || "Нет данных"}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>,
    document.body,
  );
}

function HomeFallback() {
  return (
    <AppShell>
      <div className="space-y-6 sm:space-y-8">
        <div className="flex gap-4 overflow-hidden">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="flex flex-col items-center gap-2">
              <div className="h-[142px] w-[121px] animate-pulse rounded-2xl bg-category-image-backdrop sm:h-[167px] sm:w-[136px] lg:h-[193px] lg:w-[157px]" />
            </div>
          ))}
        </div>
        <div className="h-32 animate-pulse rounded-2xl bg-surface-container-high" />
        <div className="grid grid-cols-2 gap-2 xs:gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <MedicineCardSkeleton key={i} />
          ))}
        </div>
      </div>
    </AppShell>
  );
}

function HomeContent() {
  const role = useAppSelector((s) => s.auth.role);
  const hydrated = useAppSelector((s) => s.auth.hydrated);
  const isAdminOrSA = role === "Admin" || role === "PharmacyAccount" || role === "SuperAdmin";
  const isStaff = role === "Admin" || role === "PharmacyAccount" || role === "SuperAdmin" || role === "Pharmacist";
  const loadDeliveryAddress = useDeliveryAddressStore((s) => s.load);
  const selectedPharmacy = usePharmacyStore((s) => s.selectedPharmacy);
  // Legacy picker trigger. Existing UI calls `openPicker()` from the store;
  // on the home page that now means "open the full city pharmacies map"
  // directly, without the old intermediate picker modal.
  const isPickerOpen = usePharmacyStore((s) => s.isPickerOpen);
  const closePicker = usePharmacyStore((s) => s.closePicker);
  const searchParams = useSearchParams();
  const navRouter = useRouter();

  // Auto-redirect by role
  useEffect(() => {
    if (role === "Admin" || role === "PharmacyAccount") navRouter.replace("/workspace");
    else if (role === "SuperAdmin") navRouter.replace("/superadmin");
    else if (role === "Pharmacist") navRouter.replace("/pharmacist");
  }, [role, navRouter]);

  // Restore view & query from URL params on mount
  const urlSearch = searchParams.get("search") ?? "";
  const urlPharmacy = searchParams.get("pharmacy") ?? "";

  // View mode: "home" | "search" — catalog moved to dedicated /catalog routes
  // for SEO-friendly URLs.
  const [view, setView] = useState<"home" | "search">(searchParams.has("search") ? "search" : "home");

  // Push current search filters into the address bar via replaceState so the
  // URL is shareable / back-buttonable for any combination of (query, pharmacy
  // filter). Used by every filter change site — typing, suggestion picks,
  // pharmacy chip toggles, popular queries, clears.
  function syncSearchUrl(q: string, pharmacyIdFilter: string) {
    const url = new URL(window.location.href);
    if (q.trim()) url.searchParams.set("search", q.trim());
    else url.searchParams.set("search", "");
    if (pharmacyIdFilter) url.searchParams.set("pharmacy", pharmacyIdFilter);
    else url.searchParams.delete("pharmacy");
    window.history.replaceState({}, "", url.toString());
    replaceLastNavigation(url.pathname + url.search);
  }

  // Address modal — auto-open on first visit if no address saved
  const [showAddressModal, setShowAddressModal] = useState(false);
  const [showDushanbeMapModal, setShowDushanbeMapModal] = useState(false);
  const [isFirstVisit, setIsFirstVisit] = useState(false);
  const addressChecked = useRef(false);

  useEffect(() => {
    if (!isPickerOpen) return;
    closePicker();
    navRouter.push("/pharmacies");
  }, [isPickerOpen, closePicker, navRouter]);

  const [categories, setCategories] = useState<ApiCategory[]>([]);

  // Search view
  const [query, setQuery] = useState(urlSearch);
  const [pharmacyResults, setPharmacyResults] = useState<ApiPharmacyMedicinesGroup[]>([]);
  const [searchTotalCount, setSearchTotalCount] = useState(0);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const liveDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [liveSuggestions, setLiveSuggestions] = useState<LiveSearchSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  // Per-pharmacy scroll pagination (pharmacyId → page index)
  const [pharmacyScrollPage, setPharmacyScrollPage] = useState<Record<string, number>>({});
  const CARDS_PER_SCROLL_PAGE = 20;

  // Pharmacy filter in search
  const [selectedSearchPharmacyId, setSelectedSearchPharmacyId] = useState<string>("");
  // When user enters search via a pharmacy banner, this pin overrides the global pharmacy
  // until search is closed. After exit, global selection is used again.
  const [pinnedSearchPharmacy, setPinnedSearchPharmacy] = useState<ActivePharmacy | null>(null);

  useEffect(() => {
    getCategories().then(setCategories).catch(() => undefined);
  }, []);

  // Cache of pharmacy-id → iconUrl so we can render logos without issuing
  // doomed-to-404 requests for pharmacies that have no icon uploaded yet.
  const [pharmacyIconsById, setPharmacyIconsById] = useState<Record<string, string | null | undefined>>({});
  useEffect(() => {
    getActivePharmacies()
      .then((list) => {
        const next: Record<string, string | null | undefined> = {};
        for (const p of list) next[p.id] = p.iconUrl;
        setPharmacyIconsById(next);
      })
      .catch(() => undefined);
  }, []);

  // Per-rail medicines, keyed by RailSpec.id. We populate these in parallel as
  // responses arrive so each rail can flip from skeleton → content
  // independently. Keyed map makes it trivial to skip already-fetched rails on
  // re-render and to blow the whole cache when the pharmacy filter changes.
  const [railMeds, setRailMeds] = useState<Record<string, ApiMedicine[]>>({});
  // Tracks rails that already have a fetch in-flight OR have completed
  // successfully, so re-renders inside the rail-fetch effect don't
  // double-dispatch. Lives in a ref (not state) because we only need
  // it to coordinate side-effects, not drive rendering. The previous
  // version used `railMeds[spec.id]` as the in-flight signal which had
  // a nasty failure mode: ONE transient .catch() would freeze the rail
  // as an empty array forever, since `[]` is truthy. We now leave the
  // entry undefined on error and let a single retry tick re-attempt.
  const railFetchedRef = useRef<Set<string>>(new Set());
  // Bumping this triggers the rail-fetch effect to re-run after a
  // failed attempt. Combined with the ref-based de-duplication, we get
  // "fetch once, retry once on failure, then stop" semantics — instead
  // of the old "fetch once, on failure die silently" path.
  const [railRetryTick, setRailRetryTick] = useState(0);
  // Resolves RailSpec.keywords → concrete category (id + slug) using the
  // loaded categories tree. `null` keyword list stays null (the "Popular" rail).
  type RailCatRef = { id: string | null; slug: string | null } | undefined;
  const railCategoryRefs = useMemo(() => {
    const allCats = [...categories, ...categories.flatMap((c) => c.children ?? [])];
    const out: Record<string, RailCatRef> = {};
    for (const spec of HOME_RAILS) {
      if (spec.keywords === null) {
        out[spec.id] = { id: null, slug: null };
        continue;
      }
      const match = allCats.find((c) => spec.keywords!.some((kw) => c.name.toLowerCase().includes(kw)));
      out[spec.id] = match ? { id: match.id, slug: match.slug } : undefined;
    }
    return out;
  }, [categories]);
  const railCategoryIds = useMemo(() => {
    const out: Record<string, string | null | undefined> = {};
    for (const [k, v] of Object.entries(railCategoryRefs)) {
      out[k] = v === undefined ? undefined : v.id;
    }
    return out;
  }, [railCategoryRefs]);

  // Reset the rail cache whenever the user switches pharmacy — stock differs.
  // Also wipes the in-flight ref so the new pharmacy's rails actually
  // refetch (without the clear they'd see the rail as already-fetched).
  useEffect(() => {
    setRailMeds({});
    railFetchedRef.current.clear();
  }, [selectedPharmacy?.id]);

  // Fire a parallel fetch for every rail that has a resolved categoryId (or
  // null for "any category"). Rails whose category wasn't found are silently
  // skipped — they simply won't render. The ref-based gate + a one-shot
  // retry on .catch() is the cure for the old "popular rail disappears on
  // refresh when a transient network/cold-start blip hits" bug.
  useEffect(() => {
    for (const spec of HOME_RAILS) {
      if (railFetchedRef.current.has(spec.id)) continue;
      const catId = railCategoryIds[spec.id];
      if (catId === undefined) continue;
      railFetchedRef.current.add(spec.id);
      const request = spec.id === "popular"
        ? getFastPopularMedicines(selectedPharmacy?.id)
        : getCatalogMedicinesPaginated(1, 10, catId || undefined, selectedPharmacy?.id);
      request
        .then((data) => {
          setRailMeds((prev) => ({ ...prev, [spec.id]: Array.isArray(data?.medicines) ? data.medicines : [] }));
        })
        .catch(() => {
          // Transient blip — drop the rail from "fetched" so it picks
          // up again on the next effect run, and schedule that run for
          // 2s from now. Bumping railRetryTick is what actually
          // reschedules — the effect's dep array reads it. We don't
          // mark the cache as `[]` here: doing so would freeze the rail
          // empty forever (`[]` is truthy, our old guard let it pass).
          railFetchedRef.current.delete(spec.id);
          setTimeout(() => setRailRetryTick((t) => t + 1), 2000);
        });
    }
  }, [railCategoryIds, selectedPharmacy?.id, railRetryTick]);

  useEffect(() => { loadDeliveryAddress(); }, [loadDeliveryAddress]);

  // Auto-open address modal on first visit if no address stored
  useEffect(() => {
    if (addressChecked.current) return;
    addressChecked.current = true;
    const saved = typeof window !== "undefined" ? localStorage.getItem("yalla.delivery.address") : null;
    if (!saved && !hasDismissedAddressPrompt()) {
      setIsFirstVisit(true);
      setShowAddressModal(true);
    }
  }, []);

  // Search by pharmacy
  function doSearch(q: string, presetPharmacyId?: string) {
    if (!q.trim()) {
      setPharmacyResults([]);
      setSearchTotalCount(0);
      return;
    }
    setSearchLoading(true);
    setSearchError(null);
    searchByPharmacy(q.trim(), 20)
      .then((data) => {
        setPharmacyResults(data.pharmacies ?? []);
        setSearchTotalCount(data.totalCount ?? 0);
        setPharmacyScrollPage({});
        const groups = data.pharmacies ?? [];
        // Resolution priority for pre-selecting the pharmacy chip:
        //   1. explicit preset (from URL on mount or pharmacy chip click)
        //   2. pinned pharmacy (entered search via banner)
        //   3. globally selected pharmacy (top-bar pharmacy picker)
        //   4. nothing — "Все аптеки" view
        if (presetPharmacyId && groups.some((p) => p.pharmacyId === presetPharmacyId)) {
          setSelectedSearchPharmacyId(presetPharmacyId);
        } else if (pinnedSearchPharmacy && groups.some((p) => p.pharmacyId === pinnedSearchPharmacy.id)) {
          setSelectedSearchPharmacyId(pinnedSearchPharmacy.id);
        } else if (!pinnedSearchPharmacy && selectedPharmacy && groups.some((p) => p.pharmacyId === selectedPharmacy.id)) {
          setSelectedSearchPharmacyId(selectedPharmacy.id);
        } else {
          setSelectedSearchPharmacyId("");
        }
      })
      .catch((err) => {
        setSearchError(err instanceof Error ? err.message : "Ошибка поиска");
      })
      .finally(() => setSearchLoading(false));
  }

  function onSearchInput(value: string) {
    setQuery(value);

    // Live search suggestions (fast, 150ms debounce)
    if (liveDebounceRef.current) clearTimeout(liveDebounceRef.current);
    if (value.trim().length >= 2) {
      setShowSuggestions(true);
      liveDebounceRef.current = setTimeout(() => {
        liveSearch(value.trim(), 8).then(setLiveSuggestions).catch(() => setLiveSuggestions([]));
      }, 150);
    } else {
      setLiveSuggestions([]);
      setShowSuggestions(false);
    }

    // Full search (350ms debounce)
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      doSearch(value);
      syncSearchUrl(value, selectedSearchPharmacyId);
    }, 350);
  }

  function openSearch(initialQuery = "") {
    setView("search");
    setQuery(initialQuery);
    if (initialQuery) {
      doSearch(initialQuery);
      syncSearchUrl(initialQuery, selectedSearchPharmacyId);
    }
    setTimeout(() => searchInputRef.current?.focus(), 100);
  }

  // Sync view with URL search params in BOTH directions. Forward: GlobalTopBar
  // search click → router.push("/?search=") → enter search view. Reverse:
  // browser back removes the ?search= param → leave search view and reset its
  // local state (previously the component stayed stuck in search view with
  // stale chips/filters after browser back).
  useEffect(() => {
    const urlQ = searchParams.get("search");
    if (urlQ !== null) {
      if (view !== "search") openSearch(urlQ);
    } else if (view === "search") {
      setView("home");
      setQuery("");
      setPharmacyResults([]);
      setSearchTotalCount(0);
      setSearchError(null);
      setSelectedSearchPharmacyId("");
      setPinnedSearchPharmacy(null);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  function closeSearch() {
    setView("home");
    setQuery("");
    setPharmacyResults([]);
    setSearchTotalCount(0);
    setSearchError(null);
    setSelectedSearchPharmacyId("");
    setPinnedSearchPharmacy(null);
    // Use browser history — it knows the real previous URL even when typing
    // in the search box (replaceState doesn't add new entries)
    if (typeof window !== "undefined" && window.history.length > 1) {
      navRouter.back();
    } else {
      navRouter.replace("/");
    }
  }

  // Restore search results from URL on mount, including pharmacy filter so
  // shared / refreshed links land on the same filtered results the user sent.
  const searchRestored = useRef(false);
  useEffect(() => {
    if (searchRestored.current || !urlSearch) return;
    searchRestored.current = true;
    doSearch(urlSearch, urlPharmacy || undefined);
  }, [urlSearch, urlPharmacy]);

  useEffect(() => {
    if (view !== "search") return;
    const focusTimer = window.setTimeout(() => {
      searchInputRef.current?.focus();
    }, 80);
    return () => window.clearTimeout(focusTimer);
  }, [view]);

  useEffect(() => {
    if (typeof document === "undefined") return;

    if (typeof IntersectionObserver === "undefined") {
      document.querySelectorAll(".home-reveal").forEach((element) => element.classList.add("visible"));
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("visible");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.1 },
    );

    const elements = document.querySelectorAll(".home-reveal:not(.visible)");
    elements.forEach((element) => observer.observe(element));

    return () => observer.disconnect();
  }, [view, railCategoryRefs, railMeds, isAdminOrSA]);

  // Match quick category label to actual category via keywords, then
  // navigate to its dedicated /catalog/[slug] page (SEO).
  function onQuickCategoryClick(label: string) {
    if (label === "Все категории") {
      navRouter.push("/catalog");
      return;
    }
    const quickCat = QUICK_CATEGORIES.find((c) => c.label === label);
    const keywords = quickCat?.keywords ?? [label.toLowerCase()];
    const allCats = [...categories, ...categories.flatMap((c) => c.children ?? [])];
    const match = allCats.find((c) => {
      const name = c.name.toLowerCase();
      return keywords.some((kw) => name.includes(kw));
    });
    if (match) navRouter.push(`/catalog/${match.slug}`);
    else navRouter.push("/catalog");
  }

  // Staff guard — renders nothing while the auth-redirect effect above hops
  // them to /workspace / /superadmin / /pharmacist. Without this the client
  // home page (catalog + categories + popular rails) flashes for one frame
  // before the navigator runs, which looks like a broken redirect.
  if (hydrated && isStaff) {
    return null;
  }

  function renderHomeRail(spec: RailSpec, revealDelay = 1) {
    const ref = railCategoryRefs[spec.id];
    // Keyword-defined rail that found no matching category -> drop it.
    if (spec.keywords !== null && (ref === undefined || !ref.id)) return null;

    const meds = railMeds[spec.id];
    const target = ref?.slug ? `/catalog/${ref.slug}` : "/catalog";

    return (
      <div
        key={spec.id}
        className={`home-reveal scroll-safe-top home-reveal-delay-${Math.min(revealDelay, 5)}`}
      >
        <MedicineRail
          title={spec.title}
          accent={spec.accent}
          medicines={meds ?? []}
          isLoading={meds === undefined}
          onViewAll={() => navRouter.push(target)}
        />
      </div>
    );
  }

  // ── SEARCH VIEW ──
  if (view === "search") {
    return (
      <AppShell hideFooter>
        <div className="space-y-5 sm:space-y-7 lg:space-y-8 overflow-x-hidden">
          <section className="space-y-3 xs:space-y-4 min-w-0">
            {/* Search header */}
            <div className="flex items-center gap-1.5 xs:gap-2 sm:gap-3">
              <button
                type="button"
                onClick={closeSearch}
                className="flex h-8 w-8 xs:h-9 xs:w-9 sm:h-10 sm:w-10 flex-shrink-0 items-center justify-center rounded-xl bg-surface-container-low text-on-surface-variant hover:bg-surface-container-high transition"
                aria-label="Назад"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="xs:w-[18px] xs:h-[18px]"><polyline points="15 18 9 12 15 6"/></svg>
              </button>
              <input
                ref={searchInputRef}
                className="stitch-input flex-1 min-w-0 text-sm"
                type="search"
                placeholder="Название лекарства..."
                value={query}
                onChange={(e) => onSearchInput(e.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    searchInputRef.current?.blur();
                  }
                }}
                autoFocus
              />
              {query && (
                <button
                  type="button"
                  onClick={() => { setQuery(""); setPharmacyResults([]); setSearchTotalCount(0); syncSearchUrl("", selectedSearchPharmacyId); searchInputRef.current?.focus(); }}
                  className="flex h-8 w-8 xs:h-9 xs:w-9 sm:h-10 sm:w-10 flex-shrink-0 items-center justify-center rounded-xl bg-surface-container-low text-on-surface-variant hover:bg-surface-container-high transition"
                  aria-label="Очистить"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="xs:w-4 xs:h-4"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
              )}
            </div>

            {/* Live search suggestions */}
            {showSuggestions && liveSuggestions.length > 0 && (
              <div className="stitch-card p-1 space-y-0.5 max-h-[50vh] overflow-y-auto">
                {liveSuggestions.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    className="w-full text-left rounded-lg px-3 py-2 hover:bg-surface-container-low transition flex items-center justify-between gap-2"
                    onClick={() => {
                      setShowSuggestions(false);
                      setQuery(s.title);
                      doSearch(s.title);
                      syncSearchUrl(s.title, selectedSearchPharmacyId);
                    }}
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{s.title}</p>
                      {s.categoryName ? <p className="text-[10px] text-on-surface-variant">{s.categoryName}</p> : null}
                    </div>
                    {s.minPrice ? <span className="text-xs font-bold text-primary flex-shrink-0">{s.minPrice.toFixed(0)} TJS</span> : null}
                  </button>
                ))}
              </div>
            )}

            {/* Pharmacy filter — always visible when results exist */}
            {pharmacyResults.length > 0 && (
              <div className="space-y-2">
                {/* Selected pharmacy banner */}
                {selectedSearchPharmacyId ? (() => {
                  const selected = pharmacyResults.find((p) => p.pharmacyId === selectedSearchPharmacyId);
                  return selected ? (
                    <div className="flex items-center gap-3 rounded-xl bg-primary/5 border border-primary/20 px-4 py-3">
                      <PharmacyLogo
                        pharmacyId={selected.pharmacyId}
                        iconUrl={pharmacyIconsById[selected.pharmacyId]}
                        size={40}
                        className="flex-shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-on-surface">{selected.pharmacyTitle}</p>
                        <p className="text-xs text-on-surface-variant">Найдено {selected.totalInPharmacy} товаров</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => { setSelectedSearchPharmacyId(""); setPinnedSearchPharmacy(null); syncSearchUrl(query, ""); }}
                        className="flex items-center justify-center w-8 h-8 rounded-full bg-surface-container-low hover:bg-surface-container-high transition"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                      </button>
                    </div>
                  ) : null;
                })() : null}

                {/* Pharmacy chips — always shown */}
                <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                  <button
                    type="button"
                    onClick={() => { setSelectedSearchPharmacyId(""); setPinnedSearchPharmacy(null); syncSearchUrl(query, ""); }}
                    className={`flex items-center gap-1.5 rounded-full px-3 py-2 text-xs font-semibold whitespace-nowrap flex-shrink-0 transition ${
                      !selectedSearchPharmacyId
                        ? "bg-primary text-on-primary shadow-sm"
                        : "bg-surface-container-low text-on-surface-variant hover:bg-surface-container-high"
                    }`}
                  >
                    Все аптеки
                  </button>
                  {pharmacyResults.map((group) => (
                    <button
                      key={group.pharmacyId}
                      type="button"
                      onClick={() => {
                        const next = selectedSearchPharmacyId === group.pharmacyId ? "" : group.pharmacyId;
                        if (selectedSearchPharmacyId === group.pharmacyId) setPinnedSearchPharmacy(null);
                        setSelectedSearchPharmacyId(next);
                        syncSearchUrl(query, next);
                      }}
                      className={`flex items-center gap-2 rounded-full px-1 pr-3 py-1 text-xs font-semibold whitespace-nowrap flex-shrink-0 transition ${
                        selectedSearchPharmacyId === group.pharmacyId
                          ? "bg-primary text-on-primary shadow-sm"
                          : "bg-surface-container-low text-on-surface hover:bg-surface-container-high"
                      }`}
                    >
                      <PharmacyLogo
                        pharmacyId={group.pharmacyId}
                        iconUrl={pharmacyIconsById[group.pharmacyId]}
                        size={28}
                        className="flex-shrink-0"
                      />
                      {group.pharmacyTitle}
                      <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                        selectedSearchPharmacyId === group.pharmacyId ? "bg-white/20" : "bg-surface-container-high"
                      }`}>
                        {group.totalInPharmacy}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Pinned pharmacy badge — shown when entered search via banner */}
            {pinnedSearchPharmacy && (
              <div className="flex items-center gap-2 rounded-xl bg-primary/5 border border-primary/20 px-3 py-2">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="text-primary flex-shrink-0">
                  <path d="M3 21h18"/><path d="M5 21V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16"/>
                </svg>
                <span className="text-xs font-semibold flex-1 truncate">Поиск в аптеке: {pinnedSearchPharmacy.title}</span>
              </div>
            )}

            {/* No query yet — show popular */}
            {!query.trim() && (
              <div className="space-y-3">
                <h3 className="text-xs xs:text-sm font-bold text-on-surface-variant">Популярные запросы</h3>
                <div className="flex flex-wrap gap-1.5 xs:gap-2">
                  {POPULAR_QUERIES.map((q) => (
                    <button
                      key={q}
                      type="button"
                      onClick={() => { setQuery(q); doSearch(q); syncSearchUrl(q, selectedSearchPharmacyId); }}
                      className="rounded-full bg-surface-container-low px-3 py-1.5 xs:px-4 xs:py-2 text-xs xs:text-sm font-medium text-on-surface hover:bg-surface-container-high transition"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Loading — show skeletons of the same shape as results so the page
                doesn't reflow when data arrives. */}
            {searchLoading && (
              <div className="grid grid-cols-2 gap-2 xs:gap-3 sm:grid-cols-3 sm:gap-4 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
                {Array.from({ length: 12 }).map((_, i) => (
                  <MedicineCardSkeleton key={i} compact />
                ))}
              </div>
            )}

            {/* Error */}
            {searchError && (
              <div className="rounded-xl bg-red-100 p-4 text-sm text-red-700">{searchError}</div>
            )}

            {/* Results */}
            {query.trim() && !searchLoading && !searchError && (() => {
              const filteredResults = selectedSearchPharmacyId
                ? pharmacyResults.filter((g) => g.pharmacyId === selectedSearchPharmacyId)
                : pharmacyResults;
              const showAsGrid = filteredResults.length === 1;

              return (
              <div className="space-y-5">
                {searchTotalCount > 0 && (
                  <p className="text-sm font-semibold text-on-surface-variant">
                    Найдено {selectedSearchPharmacyId
                      ? filteredResults[0]?.totalInPharmacy ?? 0
                      : searchTotalCount
                    } {(() => {
                      const n = selectedSearchPharmacyId ? (filteredResults[0]?.totalInPharmacy ?? 0) : searchTotalCount;
                      return n === 1 ? "результат" : n < 5 ? "результата" : "результатов";
                    })()}
                  </p>
                )}

                {pharmacyResults.length === 0 && (
                  <div className="stitch-card p-6 text-sm text-on-surface-variant text-center">
                    Ничего не найдено по запросу &laquo;{query}&raquo;
                  </div>
                )}

                {/* Single pharmacy or filtered → regular grid */}
                {showAsGrid && filteredResults.length === 1 && (
                  <div className="grid grid-cols-2 gap-2 xs:gap-3 sm:grid-cols-3 sm:gap-4 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
                    {filteredResults[0].medicines.map((medicine) => (
                      <MedicineCard key={medicine.id} medicine={medicine} hideCart={isAdminOrSA} compact />
                    ))}
                  </div>
                )}

                {/* Multiple pharmacies → scrollable blocks per pharmacy */}
                {!showAsGrid && filteredResults.map((group) => {
                  const scrollPage = pharmacyScrollPage[group.pharmacyId] ?? 0;
                  const totalScrollPages = Math.ceil(group.medicines.length / CARDS_PER_SCROLL_PAGE);
                  const visibleMeds = group.medicines.slice(
                    scrollPage * CARDS_PER_SCROLL_PAGE,
                    (scrollPage + 1) * CARDS_PER_SCROLL_PAGE
                  );

                  return (
                    <div key={group.pharmacyId} className="space-y-2">
                      {/* Pharmacy header */}
                      <div className="flex items-center gap-1.5 xs:gap-2 sm:gap-3">
                        <div className="flex h-7 w-7 xs:h-8 xs:w-8 sm:h-10 sm:w-10 items-center justify-center rounded-full bg-primary/10 text-primary flex-shrink-0">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="xs:w-4 xs:h-4 sm:w-5 sm:h-5"><path d="M3 21h18"/><path d="M9 8h1"/><path d="M9 12h1"/><path d="M9 16h1"/><path d="M14 8h1"/><path d="M14 12h1"/><path d="M14 16h1"/><path d="M5 21V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16"/></svg>
                        </div>
                        <div className="min-w-0 flex-1">
                          <h3 className="text-[11px] xs:text-xs sm:text-sm font-bold truncate">{group.pharmacyTitle}</h3>
                          <p className="text-[9px] xs:text-[10px] sm:text-xs text-on-surface-variant">{group.totalInPharmacy} {group.totalInPharmacy === 1 ? "товар" : group.totalInPharmacy < 5 ? "товара" : "товаров"}</p>
                        </div>
                        {/* Scroll page arrows */}
                        {totalScrollPages > 1 && (
                          <div className="flex items-center gap-1 flex-shrink-0">
                            <button
                              type="button"
                              disabled={scrollPage <= 0}
                              onClick={() => setPharmacyScrollPage((prev) => ({ ...prev, [group.pharmacyId]: scrollPage - 1 }))}
                              className="flex h-7 w-7 items-center justify-center rounded-lg bg-surface-container-low text-on-surface-variant disabled:opacity-30 hover:bg-surface-container-high transition"
                              aria-label="Назад"
                            >
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="15 18 9 12 15 6"/></svg>
                            </button>
                            <span className="text-[10px] font-semibold text-on-surface-variant tabular-nums">{scrollPage + 1}/{totalScrollPages}</span>
                            <button
                              type="button"
                              disabled={scrollPage >= totalScrollPages - 1}
                              onClick={() => setPharmacyScrollPage((prev) => ({ ...prev, [group.pharmacyId]: scrollPage + 1 }))}
                              className="flex h-7 w-7 items-center justify-center rounded-lg bg-surface-container-low text-on-surface-variant disabled:opacity-30 hover:bg-surface-container-high transition"
                              aria-label="Вперёд"
                            >
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="9 18 15 12 9 6"/></svg>
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Horizontal scroll cards */}
                      <div className="overflow-x-auto pb-2 scroll-touch">
                        <div className="flex w-max gap-1 xs:gap-1.5 sm:gap-2.5 pr-3">
                          {visibleMeds.map((medicine) => (
                            <div key={medicine.id} className="w-[120px] xs:w-[130px] sm:w-[155px] max-w-[160px] flex-shrink-0">
                              <MedicineCard medicine={medicine} hideCart={isAdminOrSA} compact />
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              );
            })()}
          </section>

        </div>
      </AppShell>
    );
  }

  // ── HOME VIEW ──
  return (
    <AppShell>
      <AddressPickerModal
        open={showAddressModal}
        onClose={() => {
          const saved = typeof window !== "undefined" ? localStorage.getItem("yalla.delivery.address") : null;
          if (isFirstVisit && !saved) {
            rememberAddressPromptDismissal();
          }
          setShowAddressModal(false);
          setIsFirstVisit(false);
        }}
        autoGeolocate={isFirstVisit}
      />
      <DushanbePharmacyMapModal open={showDushanbeMapModal} onClose={() => setShowDushanbeMapModal(false)} />
      <div className="space-y-6 sm:space-y-8 overflow-x-clip">

          {/* Quick categories — Yandex-style horizontal rail */}
          <section className="home-reveal scroll-safe-top space-y-3">
            <h2 className="px-0.5 font-display text-lg font-extrabold text-on-surface sm:text-xl">
              Категории товаров
            </h2>
            <div className="flex gap-4 overflow-x-auto scrollbar-hide scroll-touch pb-3 sm:gap-5">
              {QUICK_CATEGORIES.map((cat) => (
                <div key={cat.label} className="flex-shrink-0">
                  <CategoryTile
                    icon={cat.icon}
                    palette={cat.palette}
                    label={cat.label}
                    /* The "Все категории" anchor uses the minimalist
                       arrow variant — no image, label top-left, round
                       arrow CTA bottom-right. Reads as "open the full
                       list" instead of competing with the photographic
                       category tiles next to it. */
                    image={cat.label === "Все категории" ? undefined : cat.image}
                    variant={cat.label === "Все категории" ? "arrow" : "default"}
                    onClick={() => onQuickCategoryClick(cat.label)}
                  />
                </div>
              ))}
            </div>
          </section>

          {/* Prescription-decoding CTA for tablet/desktop below xl. At xl+
              the same action lives inline in the header. */}
          {!isAdminOrSA ? (
            <Link
              href="/prescriptions/new"
              className="home-reveal home-reveal-delay-2 hidden items-center gap-3 rounded-2xl border border-primary/20 bg-primary-soft p-3 transition active:scale-95 hover:bg-primary/15 sm:flex sm:p-4 xl:hidden"
            >
              <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-primary text-on-primary shadow-card sm:h-12 sm:w-12">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                  <line x1="9" y1="14" x2="15" y2="14" />
                  <line x1="12" y1="11" x2="12" y2="17" />
                </svg>
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-on-surface sm:text-base">Загрузите рецепт от врача</p>
                <p className="text-[11px] text-on-surface-variant sm:text-xs">
                  Фармацевт расшифрует и пришлёт готовый список лекарств · 3 TJS
                </p>
              </div>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0 text-primary" aria-hidden="true">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </Link>
          ) : null}

          {/* Popular products first — this is the primary shopping block after
              category shortcuts. */}
          {renderHomeRail(HOME_RAILS[0], 2)}

          {/* Phone actions — after popular products on small screens. */}
          {!isAdminOrSA ? (
            <div className="home-reveal home-reveal-delay-2 grid grid-cols-2 gap-2 sm:hidden">
              <Link
                href="/prescriptions/new"
                className="flex min-h-[74px] min-w-0 items-center gap-2 rounded-2xl border border-primary/20 bg-primary-soft p-2.5 text-left transition active:scale-95 hover:bg-primary/15"
              >
                <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-primary text-on-primary shadow-card">
                  <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                    <line x1="9" y1="14" x2="15" y2="14" />
                    <line x1="12" y1="11" x2="12" y2="17" />
                  </svg>
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-bold leading-tight text-on-surface">Загрузите рецепт</span>
                  <span className="mt-1 block truncate text-[11px] leading-tight text-on-surface-variant">Расшифровка · 3 TJS</span>
                </span>
              </Link>

              <Link
                href="/pharmacies"
                className="flex min-h-[74px] min-w-0 items-center gap-2 rounded-2xl bg-primary-soft p-2.5 text-left text-primary shadow-card transition active:scale-95 hover:bg-primary/15"
              >
                <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-primary/15">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M20 10c0 4.5-5.5 10-8 12C9.5 20 4 14.5 4 10a8 8 0 0 1 16 0Z" />
                    <circle cx="12" cy="10" r="2.5" />
                  </svg>
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-bold leading-tight">Все аптеки</span>
                  <span className="mt-1 block truncate text-[11px] font-semibold leading-tight text-primary/80">Аптеки на карте</span>
                </span>
              </Link>
            </div>
          ) : null}

          <div className="home-reveal home-reveal-delay-2">
            <PharmacyIntegrationBanner />
          </div>

          {/* Pharmacy entry */}
          <div className="home-reveal home-reveal-delay-3 hidden sm:block">
            <PharmaciesEntryBlock />
          </div>

          {/* Rails — fixed-count horizontal shelves, one per popular category.
              Each fetches independently so they flip from skeleton → content
              as their data arrives. Empty rails (no matching category or
              zero stock) are hidden automatically by MedicineRail.
              "Все →" navigates to the dedicated /catalog/[slug] route so
              search engines can index each category page. */}
          <div className="space-y-8 sm:space-y-12">
            {HOME_RAILS.slice(1).map((spec, index) => renderHomeRail(spec, (index % 3) + 1))}
          </div>

          {/* Footer CTA to the full catalog */}
          <div className="home-reveal home-reveal-delay-2 flex justify-center pt-4">
            <Link
              href="/catalog"
              className="rounded-full bg-surface-container px-6 py-3 text-sm font-bold text-on-surface transition active:scale-95 hover:bg-surface-container-high"
            >
              Открыть каталог →
            </Link>
          </div>
      </div>
    </AppShell>
  );
}
