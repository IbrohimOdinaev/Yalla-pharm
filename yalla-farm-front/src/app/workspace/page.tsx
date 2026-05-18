"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { clearCredentials } from "@/features/auth/model/authSlice";
import { useAppDispatch, useAppSelector } from "@/shared/lib/redux";
import { formatMoney, formatPhone } from "@/shared/lib/format";
import { DatePicker } from "@/shared/ui";
import { StaffShell } from "@/widgets/layout/StaffShell";

import { updateAdminMe, getAdminMe } from "@/entities/admin/api";
import { getActivePharmacies, type ActivePharmacy } from "@/entities/pharmacy/api";
import { updatePharmacy } from "@/entities/pharmacy/admin-api";
import { getCatalogMedicinesPaginated, liveSearch, type LiveSearchSuggestion } from "@/entities/medicine/api";
import { getCategories } from "@/entities/category/api";
import type { ApiCategory, ApiMedicine, ApiOrder } from "@/shared/types/api";
import { upsertOffer } from "@/entities/offer/api";
import { getAdminOrders, startAssembly, markReady, markOnTheWay, deleteNewOrder, rejectPositions, adminCancelOrder } from "@/entities/order/admin-api";
import { AdminOrderDetailModal } from "@/widgets/order/AdminOrderDetailModal";
import { computeItemsTotal, computeOriginalPaid, isOrderDataLost } from "@/entities/order/totals";
import { useOrderStatusLive } from "@/features/orders/model/useOrderStatusLive";
import { useSignalREvent } from "@/shared/lib/useSignalR";
import { DeliveryBadge, deliveryBorderClass } from "@/widgets/order/DeliveryBadge";
import { MedicineCard } from "@/widgets/catalog/MedicineCard";
import { MedicineCardSkeleton } from "@/widgets/catalog/MedicineCardSkeleton";

type Tab = "dashboard" | "profile" | "offers" | "orders";

const TAB_META: Record<Tab, { eyebrow: string; title: string; description: string }> = {
  dashboard: {
    eyebrow: "Admin Dashboard",
    title: "Dashboard",
    description: "Краткая статистика аптеки за текущий день по UTC+5.",
  },
  profile: {
    eyebrow: "Admin Profile",
    title: "Профиль",
    description: "Профиль администратора, данные аптеки, адрес, статус и время работы.",
  },
  offers: {
    eyebrow: "Offer Management",
    title: "Предложения",
    description: "Каталог товаров вашей аптеки: цены, остатки и скрытие предложений.",
  },
  orders: {
    eyebrow: "Order Board",
    title: "Заказы",
    description: "Операционная доска заказов по статусам с действиями для сборки и доставки.",
  },
};

const ALL_STATUSES = ["New", "UnderReview", "Preparing", "Ready", "OnTheWay", "DriverArrived", "Delivered", "PickedUp", "Cancelled", "Returned"];
const STATUS_LABELS: Record<string, string> = {
  New: "Новые", UnderReview: "На рассмотрении", Preparing: "Собирается",
  Ready: "Готов", OnTheWay: "В пути", DriverArrived: "Курьер на месте",
  Delivered: "Доставлен", PickedUp: "Забран клиентом",
  Cancelled: "Отменён", Returned: "Возврат"
};
const STATUS_COLORS: Record<string, string> = {
  New: "bg-tertiary", UnderReview: "bg-warning-container", Preparing: "bg-secondary-container",
  Ready: "bg-primary", OnTheWay: "bg-tertiary", DriverArrived: "bg-tertiary",
  Delivered: "bg-primary",
  PickedUp: "bg-primary", Cancelled: "bg-secondary", Returned: "bg-on-surface-variant"
};

const DUSHANBE_OFFSET_MS = 5 * 60 * 60 * 1000;

function getDushanbeTodayWindow(now = new Date()): { startUtcMs: number; endUtcMs: number; label: string } {
  const shifted = new Date(now.getTime() + DUSHANBE_OFFSET_MS);
  const year = shifted.getUTCFullYear();
  const month = shifted.getUTCMonth();
  const day = shifted.getUTCDate();
  const startUtcMs = Date.UTC(year, month, day) - DUSHANBE_OFFSET_MS;
  const endUtcMs = startUtcMs + 24 * 60 * 60 * 1000;
  const label = `${String(day).padStart(2, "0")}.${String(month + 1).padStart(2, "0")}.${year}`;
  return { startUtcMs, endUtcMs, label };
}

export default function WorkspacePage() {
  const token = useAppSelector((state) => state.auth.token);
  const role = useAppSelector((state) => state.auth.role);
  const hydrated = useAppSelector((state) => state.auth.hydrated);
  const dispatch = useAppDispatch();
  const router = useRouter();

  // Auth gate — bounce unauthenticated/non-admin visitors to the home page.
  // `replace` swaps the current entry so Back doesn't return them here.
  // Critically gated on `hydrated`: before the persisted JWT has been
  // rehydrated into the store both `token` and `role` are null, so without
  // this check a page reload at /workspace#orders would race-redirect to /
  // (losing the hash) before the StoreProvider's role-based redirect kicked
  // us back to /workspace (also without the hash). Net result: every
  // refresh stranded the admin on the default tab.
  useEffect(() => {
    if (!hydrated) return;
    if (!token || role !== "Admin") {
      router.replace("/");
    }
  }, [hydrated, token, role, router]);
  // Each admin is bound to exactly one pharmacy. We rely on this to pick
  // their own pharmacy out of the active list (the backend doesn't ship a
  // "/me/pharmacy" endpoint yet — the JWT claim is the source of truth).
  const adminPharmacyId = useAppSelector((state) => state.auth.pharmacyId);
  const [activeTab, setActiveTab] = useState<Tab>("dashboard");

  useEffect(() => {
    function syncHash() {
      const h = window.location.hash.replace("#", "") as Tab;
      if (h === "dashboard") setActiveTab("dashboard");
      else if (h === "offers") setActiveTab("offers");
      else if (h === "orders") setActiveTab("orders");
      else if (h === "profile" || h === "pharmacy") setActiveTab("profile");
      else setActiveTab("dashboard");
    }
    syncHash();
    window.addEventListener("hashchange", syncHash);
    const interval = setInterval(syncHash, 150);
    return () => { clearInterval(interval); window.removeEventListener("hashchange", syncHash); };
  }, []);

  /* Feature 14: stat cards data */
  const [dailyStats, setDailyStats] = useState({ totalOrders: 0, cancelled: 0, returned: 0, turnover: 0, dayLabel: "" });
  const [pharmacyName, setPharmacyName] = useState("");
  const [adminName, setAdminName] = useState("");

  const refreshDailyStats = useCallback(() => {
    if (!token || role !== "Admin") return;
    getAdminOrders(token, "", 1, 1000)
      .then((data) => {
        const { startUtcMs, endUtcMs, label } = getDushanbeTodayWindow();
        const todayOrders = data.filter((order) => {
          const createdMs = order.createdAtUtc ? new Date(order.createdAtUtc).getTime() : 0;
          return createdMs >= startUtcMs && createdMs < endUtcMs;
        });
        setDailyStats({
          totalOrders: todayOrders.length,
          cancelled: todayOrders.filter((order) => order.status === "Cancelled").length,
          returned: todayOrders.filter((order) => order.status === "Returned").length,
          turnover: todayOrders.reduce((sum, order) => sum + computeItemsTotal(order), 0),
          dayLabel: label,
        });
      })
      .catch(() => undefined);
  }, [token, role]);

  useEffect(() => {
    if (!token || role !== "Admin") return;
    refreshDailyStats();
    getAdminMe(token)
      .then((admin) => setAdminName(admin.name))
      .catch(() => undefined);
    getActivePharmacies(token)
      .then((pharmacies) => {
        // Pick the admin's own pharmacy by id (NOT pharmacies[0] — that's
        // alphabetically NovaFarma for everyone). Fall back to the first
        // entry only if the JWT didn't carry a pharmacy_id (shouldn't
        // happen for Admin role).
        const mine = adminPharmacyId
          ? pharmacies.find((p) => p.id === adminPharmacyId)
          : null;
        const own = mine ?? pharmacies[0];
        if (own) {
          setPharmacyName(own.title);
        }
      })
      .catch(() => undefined);
  }, [token, role, adminPharmacyId, refreshDailyStats]);

  useEffect(() => {
    if (!token || role !== "Admin") return;
    const interval = setInterval(refreshDailyStats, 60_000);
    return () => clearInterval(interval);
  }, [token, role, refreshDailyStats]);

  // Render nothing while the auth-gate effect above performs the redirect —
  // avoids a flash of the "Access denied" stub on logout / direct hits.
  if (!token || role !== "Admin") {
    return null;
  }
  const activeMeta = TAB_META[activeTab];

  function onLogout() {
    dispatch(clearCredentials());
    router.replace("/");
  }

  return (
    <StaffShell
      title="Workspace"
      subtitle={pharmacyName ? `Admin: ${pharmacyName}` : "Кабинет аптеки"}
      userDisplayName={adminName}
      showLogoutInSidebar={false}
    >
      <div className="space-y-4">
        <div className="rounded-xl bg-gradient-to-br from-primary to-primary-container px-4 py-3 text-white sm:px-5 sm:py-4">
          <p className="text-[10px] font-bold uppercase tracking-wider opacity-75">{activeMeta.eyebrow}</p>
          <div className="mt-1 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
            <h1 className="text-lg font-extrabold sm:text-xl">{activeMeta.title}</h1>
            {pharmacyName ? (
              <p className="text-[11px] font-semibold opacity-80 sm:text-xs">{pharmacyName}</p>
            ) : null}
          </div>
          <p className="mt-1 text-xs opacity-85 sm:text-sm">{activeMeta.description}</p>
        </div>

        {activeTab === "dashboard" ? <DashboardTab dailyStats={dailyStats} pharmacyName={pharmacyName} /> : null}
        {activeTab === "profile" ? <PharmacyTab token={token} onLogout={onLogout} /> : null}
        {activeTab === "offers" ? <OffersTab token={token} /> : null}
        {activeTab === "orders" ? <OrdersTab token={token} onStatsRefresh={refreshDailyStats} /> : null}
      </div>
    </StaffShell>
  );
}

function DashboardTab({
  dailyStats,
  pharmacyName,
}: {
  dailyStats: { totalOrders: number; cancelled: number; returned: number; turnover: number; dayLabel: string };
  pharmacyName: string;
}) {
  const cards = [
    {
      label: "Заказы сегодня",
      value: dailyStats.totalOrders,
      hint: `UTC+5 · ${dailyStats.dayLabel || "сегодня"}`,
      tone: "text-primary",
    },
    {
      label: "Отменённые",
      value: dailyStats.cancelled,
      hint: "Сброс в 00:00 UTC+5",
      tone: "text-red-600",
    },
    {
      label: "Возвраты",
      value: dailyStats.returned,
      hint: "За текущий день",
      tone: "text-on-surface-variant",
    },
    {
      label: "Оборот",
      value: formatMoney(dailyStats.turnover),
      hint: "Без стоимости доставки",
      tone: "text-primary",
    },
  ];

  return (
    <section className="space-y-4">
      <div className="stitch-card p-4 sm:p-5">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">Сегодня</p>
        <h2 className="mt-1 text-lg font-extrabold">Статистика аптеки{pharmacyName ? `: ${pharmacyName}` : ""}</h2>
        <p className="mt-1 text-sm text-on-surface-variant">
          Отдельные показатели по заказам, возвратам и обороту за день. День считается по часовому поясу UTC+5.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => (
          <div key={card.label} className="stitch-card min-h-[132px] p-4 sm:p-5">
            <p className={`text-3xl font-black ${card.tone}`}>{card.value}</p>
            <p className="mt-3 text-sm font-black uppercase tracking-wider text-on-surface-variant">{card.label}</p>
            <p className="mt-1 text-xs text-on-surface-variant">{card.hint}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ── Pharmacy Tab ── */

function PharmacyTab({ token, onLogout }: { token: string; onLogout: () => void }) {
  const adminPharmacyId = useAppSelector((state) => state.auth.pharmacyId);
  const [pharmacies, setPharmacies] = useState<ActivePharmacy[]>([]);
  const [adminName, setAdminName] = useState("");
  const [adminPhone, setAdminPhone] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const [pharmaTitle, setPharmaTitle] = useState("");
  const [pharmaAddress, setPharmaAddress] = useState("");
  const [pharmaActive, setPharmaActive] = useState(true);
  const [pharmaMsg, setPharmaMsg] = useState<string | null>(null);
  const [isAllDay, setIsAllDay] = useState(true);
  const [opensAt, setOpensAt] = useState("");
  const [closesAt, setClosesAt] = useState("");

  useEffect(() => {
    getActivePharmacies(token).then(setPharmacies).catch(() => undefined);
    getAdminMe(token).then((data) => {
      setAdminName(data.name || "");
      setAdminPhone(data.phoneNumber || "");
    }).catch(() => undefined);
  }, [token]);

  // Editing the admin's own pharmacy — never the alphabetically-first entry.
  const pharmacy = adminPharmacyId
    ? pharmacies.find((p) => p.id === adminPharmacyId)
    : pharmacies[0];

  useEffect(() => {
    if (pharmacy) {
      setPharmaTitle(pharmacy.title);
      setPharmaAddress(pharmacy.address);
      setPharmaActive(pharmacy.isActive ?? true);
      const hasSchedule = Boolean(pharmacy.opensAt && pharmacy.closesAt);
      setIsAllDay(!hasSchedule);
      // Backend returns "HH:mm:ss" — trim to minutes for the <input type="time"> field.
      setOpensAt(hasSchedule ? (pharmacy.opensAt ?? "").slice(0, 5) : "");
      setClosesAt(hasSchedule ? (pharmacy.closesAt ?? "").slice(0, 5) : "");
    }
  }, [pharmacy]);

  async function onSaveAdmin(e: FormEvent) {
    e.preventDefault();
    setIsSaving(true);
    setMsg(null);
    try {
      await updateAdminMe(token, { name: adminName, phoneNumber: formatPhone(adminPhone) });
      setMsg("Профиль обновлён.");
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Ошибка.");
    } finally {
      setIsSaving(false);
    }
  }

  async function onSavePharmacy(e: FormEvent) {
    e.preventDefault();
    if (!pharmacy) return;
    setPharmaMsg(null);
    if (!isAllDay && (!opensAt || !closesAt)) {
      setPharmaMsg("Укажите время открытия и закрытия (или включите режим «Круглосуточно»).");
      return;
    }
    try {
      await updatePharmacy(token, {
        pharmacyId: pharmacy.id,
        title: pharmaTitle,
        address: pharmaAddress,
        isActive: pharmaActive,
        opensAt: isAllDay ? "" : opensAt,
        closesAt: isAllDay ? "" : closesAt,
      });
      setPharmaMsg("Аптека обновлена.");
      getActivePharmacies(token).then(setPharmacies).catch(() => undefined);
    } catch (err) {
      setPharmaMsg(err instanceof Error ? err.message : "Ошибка.");
    }
  }

  return (
    <div className="space-y-5">
      <section className="stitch-card flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
        <div>
          <h2 className="text-base font-black">Аккаунт</h2>
          <p className="mt-1 text-sm text-on-surface-variant">
            Данные пользователя, аптеки и выход из кабинета администратора.
          </p>
        </div>
        <button
          type="button"
          onClick={onLogout}
          className="inline-flex items-center justify-center rounded-2xl bg-secondary px-5 py-3 text-sm font-black text-white transition hover:bg-secondary/90"
        >
          Выйти
        </button>
      </section>

      <div className="grid gap-5 md:grid-cols-2">
      <form className="stitch-card space-y-2 xs:space-y-3 sm:space-y-4 p-3 xs:p-4 sm:p-5" onSubmit={onSaveAdmin}>
        <div>
          <h2 className="text-sm xs:text-base sm:text-lg font-bold">Профиль администратора</h2>
          <p className="mt-1 text-[10px] xs:text-xs sm:text-sm text-on-surface-variant">Ваши контактные данные и данные для входа.</p>
        </div>
        <label className="block space-y-1">
          <span className="text-sm font-medium text-on-surface-variant">Имя</span>
          <input className="stitch-input" value={adminName} onChange={(e) => setAdminName(e.target.value)} required />
        </label>
        <label className="block space-y-1">
          <span className="text-sm font-medium text-on-surface-variant">Телефон</span>
          <input className="stitch-input" type="tel" value={adminPhone} onChange={(e) => setAdminPhone(e.target.value)} required />
        </label>
        {msg ? <div className={`rounded-xl p-3 text-sm ${msg.includes("обновлён") ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}`}>{msg}</div> : null}
        <button type="submit" className="stitch-button w-full" disabled={isSaving}>{isSaving ? "Сохраняем..." : "Сохранить"}</button>
      </form>

      {pharmacy ? (
        <form className="stitch-card space-y-2 xs:space-y-3 sm:space-y-4 p-3 xs:p-4 sm:p-5" onSubmit={onSavePharmacy}>
          <div>
            <h2 className="text-sm xs:text-base sm:text-lg font-bold">Управление аптекой</h2>
            <p className="mt-1 text-[10px] xs:text-xs sm:text-sm text-on-surface-variant">Название, адрес и статус видимости для клиентов.</p>
          </div>
          <label className="block space-y-1">
            <span className="text-sm font-medium text-on-surface-variant">Название</span>
            <input className="stitch-input" value={pharmaTitle} onChange={(e) => setPharmaTitle(e.target.value)} required />
          </label>
          <label className="block space-y-1">
            <span className="text-sm font-medium text-on-surface-variant">Адрес</span>
            <input className="stitch-input" value={pharmaAddress} onChange={(e) => setPharmaAddress(e.target.value)} required />
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={pharmaActive} onChange={(e) => setPharmaActive(e.target.checked)} />
            <span>Активна</span>
          </label>

          {/* Opening hours — toggle «Круглосуточно» off to set a schedule.
              Same-day pickup stops 30 min before closing; enforced on the
              cart-pharmacy page. */}
          <div className="rounded-xl bg-surface-container-low p-3 xs:p-4 space-y-2 xs:space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="text-xs xs:text-sm font-bold text-on-surface">Время работы</p>
                <p className="mt-0.5 text-[10px] xs:text-[11px] text-on-surface-variant">
                  {isAllDay
                    ? "Аптека работает круглосуточно."
                    : "Самовывоз доступен, пока до закрытия более 30 минут."}
                </p>
              </div>
              <label className="flex flex-shrink-0 items-center gap-2 text-[11px] xs:text-xs font-semibold">
                <input
                  type="checkbox"
                  checked={isAllDay}
                  onChange={(e) => {
                    setIsAllDay(e.target.checked);
                    if (e.target.checked) {
                      setOpensAt("");
                      setClosesAt("");
                    }
                  }}
                />
                <span>Круглосуточно</span>
              </label>
            </div>

            {!isAllDay ? (
              <div className="grid grid-cols-2 gap-2 xs:gap-3">
                <label className="block space-y-1">
                  <span className="text-[11px] xs:text-xs font-medium text-on-surface-variant">Открытие</span>
                  <input
                    type="time"
                    className="stitch-input w-full tabular-nums"
                    value={opensAt}
                    onChange={(e) => setOpensAt(e.target.value)}
                    required={!isAllDay}
                  />
                </label>
                <label className="block space-y-1">
                  <span className="text-[11px] xs:text-xs font-medium text-on-surface-variant">Закрытие</span>
                  <input
                    type="time"
                    className="stitch-input w-full tabular-nums"
                    value={closesAt}
                    onChange={(e) => setClosesAt(e.target.value)}
                    required={!isAllDay}
                  />
                </label>
              </div>
            ) : null}
          </div>

          {pharmaMsg ? <div className={`rounded-xl p-3 text-sm ${pharmaMsg.includes("обновлена") ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}`}>{pharmaMsg}</div> : null}
          <button type="submit" className="stitch-button w-full">Обновить аптеку</button>
        </form>
      ) : null}
      </div>
    </div>
  );
}

/* ── Offers Tab ── */

function OffersTab({ token }: { token: string }) {
  const adminPharmacyId = useAppSelector((state) => state.auth.pharmacyId);
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [categories, setCategories] = useState<ApiCategory[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState("");
  const [expandedCategoryId, setExpandedCategoryId] = useState("");
  const [showCategoryBrowser, setShowCategoryBrowser] = useState(false);
  const [medicines, setMedicines] = useState<ApiMedicine[]>([]);
  const [suggestions, setSuggestions] = useState<LiveSearchSuggestion[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [hidingIds, setHidingIds] = useState<Record<string, boolean>>({});
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const liveDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const loadMoreSentinelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    getCategories().then(setCategories).catch(() => undefined);
  }, []);

  const flatCategories = useMemo(
    () => [...categories, ...categories.flatMap((category) => category.children ?? [])],
    [categories],
  );
  const selectedCategory = useMemo(
    () => flatCategories.find((category) => category.id === selectedCategoryId),
    [flatCategories, selectedCategoryId],
  );

  const loadPage = useCallback((targetPage: number, mode: "replace" | "append", q = debouncedQuery, categoryId = selectedCategoryId) => {
    if (!adminPharmacyId) {
      setMedicines([]);
      setIsLoading(false);
      return;
    }

    if (mode === "replace") setIsLoading(true);
    else setIsLoadingMore(true);
    setError(null);

    getCatalogMedicinesPaginated(targetPage, 24, categoryId || undefined, adminPharmacyId, q)
      .then((data) => {
        const items = Array.isArray(data.medicines) ? data.medicines : [];
        setMedicines((prev) => (mode === "append" ? [...prev, ...items] : items));
        const size = data.pageSize ?? 24;
        const total = data.totalCount ?? 0;
        setPage(data.page ?? targetPage);
        setTotalPages(Math.max(1, Math.ceil(total / size)));
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Не удалось загрузить каталог."))
      .finally(() => {
        setIsLoading(false);
        setIsLoadingMore(false);
      });
  }, [adminPharmacyId, debouncedQuery, selectedCategoryId]);

  useEffect(() => {
    loadPage(1, "replace", debouncedQuery, selectedCategoryId);
  }, [debouncedQuery, selectedCategoryId, loadPage]);

  const hasMore = page < totalPages;

  useEffect(() => {
    const sentinel = loadMoreSentinelRef.current;
    if (!sentinel || isLoading || isLoadingMore || !hasMore) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          loadPage(page + 1, "append", debouncedQuery, selectedCategoryId);
        }
      },
      { rootMargin: "700px 0px" },
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [debouncedQuery, hasMore, isLoading, isLoadingMore, loadPage, page, selectedCategoryId]);

  function onQueryChange(value: string) {
    setQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setDebouncedQuery(value.trim()), 300);

    if (liveDebounceRef.current) clearTimeout(liveDebounceRef.current);
    if (value.trim().length >= 2) {
      liveDebounceRef.current = setTimeout(() => {
        liveSearch(value.trim(), 8).then(setSuggestions).catch(() => setSuggestions([]));
      }, 150);
    } else {
      setSuggestions([]);
    }
  }

  function onSuggestionClick(title: string) {
    setQuery(title);
    setDebouncedQuery(title);
    setSuggestions([]);
  }

  function selectCategory(categoryId: string) {
    setSelectedCategoryId(categoryId);
    setShowCategoryBrowser(true);
    setSuggestions([]);
  }

  function closeCategoryBrowser() {
    setSelectedCategoryId("");
    setExpandedCategoryId("");
    setShowCategoryBrowser(false);
    setSuggestions([]);
  }

  async function onHide(medicine: ApiMedicine) {
    if (!adminPharmacyId) return;
    if (!confirm(`Скрыть товар «${medicine.title || medicine.name || medicine.id.slice(0, 8)}» для вашей аптеки?`)) return;

    setHidingIds((prev) => ({ ...prev, [medicine.id]: true }));
    try {
      await upsertOffer(token, { medicineId: medicine.id, stockQuantity: 0, price: 0 });
      setMedicines((prev) => prev.filter((item) => item.id !== medicine.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось скрыть товар.");
    } finally {
      setHidingIds((prev) => {
        const next = { ...prev };
        delete next[medicine.id];
        return next;
      });
    }
  }

  function renderMedicineGrid(inCategoryMode = false) {
    const gridClassName = inCategoryMode
      ? "grid grid-cols-2 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
      : "grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5";

    if (isLoading) {
      return (
        <div className={gridClassName}>
          {Array.from({ length: 10 }).map((_, i) => <MedicineCardSkeleton key={i} />)}
        </div>
      );
    }

    if (medicines.length === 0) {
      return (
        <div className="rounded-2xl bg-surface-container-low p-6 text-sm text-on-surface-variant">
          {debouncedQuery ? "По этому запросу активных товаров вашей аптеки не найдено." : "В вашей аптеке нет активных товаров."}
        </div>
      );
    }

    return (
      <>
        <div className={gridClassName}>
          {medicines.map((medicine) => {
            const ownOffer = (medicine.offers ?? []).find((offer) => offer.pharmacyId === adminPharmacyId && offer.price > 0);
            const ownPrice = ownOffer?.price ?? medicine.minPrice ?? medicine.price ?? null;
            return (
              <MedicineCard
                key={medicine.id}
                medicine={medicine}
                hideCart
                readOnlyPrice={ownPrice}
                readOnlyPricePrefix=""
                footerAction={
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      onHide(medicine);
                    }}
                    disabled={Boolean(hidingIds[medicine.id])}
                    className="flex h-9 w-full items-center justify-center rounded-full bg-secondary-soft px-3 text-xs font-bold text-secondary transition hover:bg-secondary/15 disabled:opacity-60"
                  >
                    {hidingIds[medicine.id] ? "Скрываем..." : "Скрыть"}
                  </button>
                }
              />
            );
          })}
          {isLoadingMore
            ? Array.from({ length: 5 }).map((_, i) => <MedicineCardSkeleton key={`more-${i}`} />)
            : null}
        </div>

        {hasMore ? <div ref={loadMoreSentinelRef} aria-hidden className="h-6" /> : null}
      </>
    );
  }

  return (
    <div className="space-y-3 sm:space-y-4">
      <div>
        <h2 className="text-sm xs:text-base sm:text-lg font-bold">Управление предложениями</h2>
        <p className="mt-1 text-[10px] xs:text-xs sm:text-sm text-on-surface-variant">Каталог товаров вашей аптеки. Скрытые товары исчезают из выдачи этой аптеки.</p>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <input
            className="stitch-input w-full"
            placeholder="Поиск по каталогу вашей аптеки..."
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
          />
          {suggestions.length > 0 ? (
            <div className="absolute left-0 right-0 top-full z-20 mt-1 overflow-hidden rounded-2xl border border-outline/60 bg-surface-container-lowest shadow-card">
              {suggestions.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onSuggestionClick(item.title)}
                  className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-surface-container-low"
                >
                  <span className="min-w-0">
                    <span className="block truncate font-semibold">{item.title}</span>
                    {item.categoryName ? <span className="block truncate text-[11px] text-on-surface-variant">{item.categoryName}</span> : null}
                  </span>
                  {item.minPrice ? <span className="shrink-0 text-xs font-bold text-primary">от {item.minPrice} TJS</span> : null}
                </button>
              ))}
            </div>
          ) : null}
        </div>
        <button
          type="button"
          className="stitch-button-secondary h-11 shrink-0 px-4"
          onClick={() => {
            setShowCategoryBrowser(true);
            setSelectedCategoryId("");
          }}
        >
          Все категории
        </button>
      </div>

      {showCategoryBrowser ? (
        <div className="rounded-2xl border border-outline/50 bg-surface-container-lowest p-3">
          <div className="flex flex-col gap-4 sm:flex-row">
            <aside className="sm:w-[240px] sm:shrink-0">
              <div className="mb-2 flex items-center justify-between gap-2">
                <h3 className="text-sm font-bold">Каталог</h3>
                <button type="button" className="text-xs font-semibold text-on-surface-variant hover:text-on-surface" onClick={closeCategoryBrowser}>
                  Свернуть
                </button>
              </div>
              <nav className="max-h-[55vh] space-y-0.5 overflow-y-auto pr-1">
                <button
                  type="button"
                  onClick={() => selectCategory("")}
                  className={`block w-full rounded-lg px-3 py-2 text-left text-sm font-medium transition ${
                    !selectedCategoryId ? "bg-primary text-white" : "text-on-surface hover:bg-surface-container-low"
                  }`}
                >
                  Все товары
                </button>
                {categories.length === 0
                  ? Array.from({ length: 8 }).map((_, index) => (
                      <div key={index} className="my-1 h-8 animate-pulse rounded-lg bg-surface-container-high" />
                    ))
                  : categories.map((category) => {
                      const isActive = selectedCategoryId === category.id;
                      const hasActiveChild = category.children?.some((child) => child.id === selectedCategoryId);
                      const isExpanded = expandedCategoryId === category.id;
                      return (
                        <div key={category.id}>
                          <button
                            type="button"
                            onClick={() => {
                              if (category.children?.length) {
                                setExpandedCategoryId(isExpanded ? "" : category.id);
                                return;
                              }
                              selectCategory(category.id);
                            }}
                            className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm font-medium transition ${
                              isActive || hasActiveChild ? "bg-primary text-white" : "text-on-surface hover:bg-surface-container-low"
                            }`}
                          >
                            <span className="truncate">{category.name}</span>
                            {category.children?.length ? (
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" className={`ml-1 shrink-0 transition ${isExpanded ? "rotate-180" : ""}`}>
                                <polyline points="6 9 12 15 18 9" />
                              </svg>
                            ) : null}
                          </button>
                          {isExpanded && category.children?.length ? (
                            <div className="ml-3 mt-0.5 space-y-0.5 border-l-2 border-surface-container-high pl-2">
                              {category.children.map((child) => (
                                <button
                                  key={child.id}
                                  type="button"
                                  onClick={() => selectCategory(child.id)}
                                  className={`block w-full rounded-lg px-3 py-1.5 text-left text-sm transition ${
                                    selectedCategoryId === child.id
                                      ? "bg-primary/80 font-semibold text-white"
                                      : "text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface"
                                  }`}
                                >
                                  {child.name}
                                </button>
                              ))}
                            </div>
                          ) : null}
                        </div>
                      );
                    })}
              </nav>
            </aside>
            <div className="min-w-0 flex-1">
              <div className="mb-3 flex items-center gap-2">
                <button
                  type="button"
                  onClick={closeCategoryBrowser}
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-surface-container-low text-primary transition hover:bg-surface-container-high"
                  aria-label="Назад к каталогу предложений"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M15 18l-6-6 6-6" />
                  </svg>
                </button>
                <h3 className="text-lg font-extrabold">{selectedCategory?.name || "Все товары"}</h3>
              </div>
              {renderMedicineGrid(true)}
            </div>
          </div>
        </div>
      ) : null}

      {error ? <div className="rounded-xl bg-red-100 p-3 text-sm text-red-700">{error}</div> : null}

      {!showCategoryBrowser ? renderMedicineGrid() : null}
    </div>
  );
}

/* ── Orders Tab (Kanban) ── */

function OrdersTab({ token, onStatsRefresh }: { token: string; onStatsRefresh?: () => void }) {
  const [orders, setOrders] = useState<ApiOrder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dateFilter, setDateFilter] = useState("");
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);

  // Deep-link: /workspace?orderId=X auto-opens modal on mount.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const id = params.get("orderId");
    if (id) setSelectedOrderId(id);
  }, []);

  const refresh = useCallback(() => {
    setIsLoading(true);
    getAdminOrders(token, "")
      .then((data) => { setOrders(data); setIsLoading(false); onStatsRefresh?.(); })
      .catch((err) => { setError(err instanceof Error ? err.message : "Ошибка."); setIsLoading(false); });
  }, [token, onStatsRefresh]);

  useOrderStatusLive(useCallback(() => { refresh(); }, [refresh]));
  useSignalREvent("PaymentIntentUpdated", useCallback(() => { refresh(); }, [refresh]), token);

  useEffect(() => { refresh(); }, [refresh]);

  // Safety-net polling: if SignalR drops, auto-transitions from JURA still land.
  useEffect(() => {
    function onFocus() {
      if (document.visibilityState === "visible") refresh();
    }
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);
    const t = setInterval(refresh, 15000);
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
      clearInterval(t);
    };
  }, [refresh]);


  async function onAction(action: string, orderId: string) {
    try {
      if (action === "assembly") await startAssembly(token, orderId);
      if (action === "ready") await markReady(token, orderId);
      if (action === "ontheway") await markOnTheWay(token, orderId);
      if (action === "delete") await deleteNewOrder(token, orderId);
      if (action === "cancel") await adminCancelOrder(token, orderId);
      refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка.");
    }
  }

  const filteredOrders = dateFilter
    ? orders.filter((o) => o.createdAtUtc && new Date(o.createdAtUtc).toISOString().slice(0, 10) === dateFilter)
    : orders;

  // Active columns run FIFO (longest-waiting first); history columns are
  // newest-first so the most recent finalised order is at the top.
  const HISTORY_STATUSES = new Set(["Delivered", "PickedUp", "Cancelled", "Returned"]);
  const orderTime = (o: ApiOrder) => o.createdAtUtc ? new Date(o.createdAtUtc).getTime() : 0;
  const grouped = ALL_STATUSES.reduce<Record<string, ApiOrder[]>>((acc, status) => {
    const list = filteredOrders.filter((o) => o.status === status);
    list.sort((a, b) => HISTORY_STATUSES.has(status)
      ? orderTime(b) - orderTime(a)
      : orderTime(a) - orderTime(b)
    );
    acc[status] = list;
    return acc;
  }, {});

  return (
    <div className="space-y-2 xs:space-y-3 sm:space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-sm xs:text-base sm:text-lg font-bold">Управление заказами</h2>
          <p className="mt-1 text-[10px] xs:text-xs sm:text-sm text-on-surface-variant">Доска заказов по всем статусам{dateFilter ? ` · ${dateFilter}` : ""}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="hidden min-w-[82px] text-right text-xs text-on-surface-variant sm:inline">
            {isLoading ? "Обновляем..." : ""}
          </span>
          <DatePicker
            value={dateFilter}
            onChange={setDateFilter}
            compact
            placeholder="Дата"
            className="w-36"
          />
          {dateFilter ? (
            <button type="button" onClick={() => setDateFilter("")} className="text-xs text-on-surface-variant hover:text-red-600">Сбросить</button>
          ) : null}
        </div>
      </div>

      {error ? <div className="rounded-xl bg-red-100 p-3 text-sm text-red-700">{error}</div> : null}

      <div className="-mx-1 flex flex-nowrap gap-4 overflow-x-auto px-1 pb-4 snap-x snap-mandatory">
        {ALL_STATUSES.map((status) => {
          const actions = (order: ApiOrder): { label: string; action: string; danger?: boolean; needsConfirm?: boolean }[] => {
            const a: { label: string; action: string; danger?: boolean; needsConfirm?: boolean }[] = [];
            if (status === "UnderReview") a.push({ label: "Начать сборку", action: "assembly", needsConfirm: true });
            if (status === "Preparing") a.push({ label: "Собран", action: "ready", needsConfirm: true });
            if (status === "Ready") a.push({ label: order.isPickup ? "Выдан клиенту" : "В пути", action: "ontheway", needsConfirm: true });
            // Cancellation available while the order is in-pharmacy
            if (status === "UnderReview" || status === "Preparing" || status === "Ready")
              a.push({ label: "Отменить", action: "cancel", danger: true });
            return a;
          };

          return (
            <div key={status} className="w-[82vw] min-w-[260px] max-w-[340px] flex-shrink-0 snap-start rounded-2xl bg-surface-container-low p-3 space-y-3 sm:w-[320px]">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className={`w-2.5 h-2.5 rounded-full ${STATUS_COLORS[status]}`} />
                  <h4 className="text-[10px] xs:text-xs sm:text-sm font-bold">{STATUS_LABELS[status]}</h4>
                </div>
                <span className="rounded-full bg-surface-container-high px-2 py-0.5 text-[10px] font-bold">{grouped[status].length}</span>
              </div>
              <div className="space-y-2 max-h-[60vh] overflow-y-auto">
                {grouped[status].map((order) => (
                  <OrderCard key={order.orderId} order={order} token={token} onRefresh={refresh} onSelect={setSelectedOrderId} actions={actions(order)} onAction={onAction} />
                ))}
                {grouped[status].length === 0 && <p className="text-xs text-on-surface-variant text-center py-4">Пусто</p>}
              </div>
            </div>
          );
        })}
      </div>

      {selectedOrderId ? (
        <AdminOrderDetailModal
          orderId={selectedOrderId}
          token={token}
          onClose={() => { setSelectedOrderId(null); refresh(); }}
          onDeleted={refresh}
        />
      ) : null}
    </div>
  );
}

function OrderCard({
  order,
  actions,
  onAction,
  token,
  onRefresh,
  onSelect,
}: {
  order: ApiOrder;
  actions: { label: string; action: string; danger?: boolean; needsConfirm?: boolean }[];
  onAction: (action: string, orderId: string) => void;
  token?: string;
  onRefresh?: () => void;
  onSelect?: (orderId: string) => void;
}) {
  const [selectedPositions, setSelectedPositions] = useState<Set<string>>(new Set());
  const [isRejecting, setIsRejecting] = useState(false);
  const showPositionReject = order.status === "Preparing" && (order.positions ?? []).length > 0;

  function togglePosition(positionId: string) {
    setSelectedPositions((prev) => {
      const next = new Set(prev);
      if (next.has(positionId)) next.delete(positionId);
      else next.add(positionId);
      return next;
    });
  }

  async function onRejectSelected() {
    if (!token || selectedPositions.size === 0) return;
    if (!confirm(`Отклонить ${selectedPositions.size} позицию(й)? Эти позиции не войдут в заказ, клиенту будет возвращена их стоимость.`)) return;
    setIsRejecting(true);
    try {
      await rejectPositions(token, order.orderId, Array.from(selectedPositions));
      setSelectedPositions(new Set());
      onRefresh?.();
    } catch { /* ignore */ }
    setIsRejecting(false);
  }

  const phoneDisplay = order.clientPhoneNumber
    ? order.clientPhoneNumber.replace(/^\+?992/, "")
    : undefined;
  const telegramHandle = order.clientTelegramUsername
    ? `@${order.clientTelegramUsername.replace(/^@/, "")}`
    : order.clientTelegramId
      ? `tg:${order.clientTelegramId}`
      : undefined;

  return (
    <div className={`stitch-card space-y-2 p-3 ${deliveryBorderClass(!!order.isPickup)}`}>
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-xs text-on-surface-variant">#{order.orderId.slice(0, 8)}</span>
        <div className="flex items-center gap-1.5">
          <DeliveryBadge isPickup={!!order.isPickup} />
          <span className="font-bold text-sm">{formatMoney(computeOriginalPaid(order), order.currency)}</span>
        </div>
      </div>
      <p className="font-mono text-[10px] text-on-surface-variant/50 break-all">{order.orderId}</p>
      {order.clientName ? <p className="text-xs font-semibold text-on-surface">{order.clientName}</p> : null}
      {phoneDisplay ? <p className="text-xs font-mono text-on-surface-variant">{phoneDisplay}</p> : null}
      {telegramHandle ? <p className="text-xs font-mono text-tertiary">{telegramHandle}</p> : null}

      {order.createdAtUtc ? (
        <p className="text-xs text-on-surface-variant tabular-nums">
          {new Date(order.createdAtUtc).toLocaleString("ru-RU", {
            day: "2-digit", month: "short", year: "numeric",
            hour: "2-digit", minute: "2-digit",
          })}
        </p>
      ) : null}

      {order.deliveryAddress ? <p className="text-xs text-on-surface-variant">{order.isPickup ? "Самовывоз" : order.deliveryAddress}</p> : null}

      {order.comment ? (
        <div className="rounded-lg bg-amber-50 border border-amber-200 px-2 py-1.5 text-xs text-amber-800">
          <p className="font-semibold text-[10px] uppercase tracking-wider text-amber-700">Комментарий</p>
          <p className="whitespace-pre-wrap">{order.comment}</p>
        </div>
      ) : null}

      {/* Orphan record warning — historic orders whose order_positions rows
          are missing in the DB. Shows up as "0 TJS / 0 поз." otherwise. */}
      {isOrderDataLost(order) ? (
        <div className="flex items-center gap-1.5 rounded-lg bg-amber-100 border border-amber-300 px-2 py-1.5 text-[11px] font-semibold text-amber-800">
          <span aria-hidden>⚠</span>
          <span>Данные позиций утеряны</span>
        </div>
      ) : null}

      {/* Position count */}
      <div className="text-xs text-on-surface-variant">
        {order.positions?.length ?? 0} поз.
      </div>

      {/* Position list with reject checkboxes for Preparing */}
      {showPositionReject ? (
        <div className="space-y-1">
          {order.positions!.map((pos) => (
            <label key={pos.positionId} className={`flex items-center gap-2 rounded-lg px-2 py-1 text-xs ${pos.isRejected ? "line-through text-on-surface-variant" : ""}`}>
              {!pos.isRejected ? (
                <input type="checkbox" checked={selectedPositions.has(pos.positionId)} onChange={() => togglePosition(pos.positionId)} />
              ) : null}
              <span>
                {pos.medicine?.title ?? pos.medicineId.slice(0, 8)}
                {" "}× {pos.useUnitMode && pos.unitCount != null ? `${pos.unitCount} шт.` : pos.quantity}
              </span>
            </label>
          ))}
          {selectedPositions.size > 0 ? (
            <button type="button" className="rounded-lg bg-red-100 px-3 py-1 text-xs font-bold text-red-700" onClick={onRejectSelected} disabled={isRejecting}>
              {isRejecting ? "Отклоняем..." : `Отклонить (${selectedPositions.size})`}
            </button>
          ) : null}
        </div>
      ) : null}

      {actions.length > 0 ? (
        <div className="flex flex-wrap gap-1">
          {actions.map((a) => (
            <button
              key={a.action}
              type="button"
              className={`rounded-lg px-3 py-1 text-xs font-bold ${a.danger ? "bg-red-100 text-red-700" : "bg-primary text-white"}`}
              onClick={() => {
                if (a.danger && !confirm(`Подтвердите: ${a.label.toLowerCase()} заказ #${order.orderId.slice(0, 8)}?`)) return;
                if (a.needsConfirm && !confirm(`${a.label}? Статус заказа #${order.orderId.slice(0, 8)} изменится.`)) return;
                onAction(a.action, order.orderId);
              }}
            >
              {a.label}
            </button>
          ))}
        </div>
      ) : null}

      {/* "Подробнее" — opens modal inline (no navigation) */}
      <button
        type="button"
        onClick={() => onSelect?.(order.orderId)}
        className="inline-block rounded-lg bg-surface-container-low px-3 py-1 text-xs font-bold text-on-surface-variant hover:bg-surface-container-high"
      >
        Подробнее
      </button>
    </div>
  );
}
