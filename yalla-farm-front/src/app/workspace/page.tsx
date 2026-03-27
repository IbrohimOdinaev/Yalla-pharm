"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { useAppSelector } from "@/shared/lib/redux";
import { formatMoney, formatPhone } from "@/shared/lib/format";
import { AppShell } from "@/widgets/layout/AppShell";
import { TopBar } from "@/widgets/layout/TopBar";

import { updateAdminMe, getAdminMe } from "@/entities/admin/api";
import { getActivePharmacies, type ActivePharmacy } from "@/entities/pharmacy/api";
import { updatePharmacy } from "@/entities/pharmacy/admin-api";
import { searchMedicines, resolveMedicineImageUrl } from "@/entities/medicine/api";
import type { ApiMedicine, ApiOrder } from "@/shared/types/api";
import { upsertOffer } from "@/entities/offer/api";
import { getAdminOrders, startAssembly, markReady, markOnTheWay, deleteNewOrder, rejectPositions } from "@/entities/order/admin-api";
import { useOrderStatusLive } from "@/features/orders/model/useOrderStatusLive";
import { useSignalREvent } from "@/shared/lib/useSignalR";

type Tab = "pharmacy" | "offers" | "orders";

const ALL_STATUSES = ["New", "UnderReview", "Preparing", "Ready", "OnTheWay", "Delivered", "Cancelled", "Returned"];
const STATUS_LABELS: Record<string, string> = {
  New: "Новые", UnderReview: "На рассмотрении", Preparing: "Собирается",
  Ready: "Готов", OnTheWay: "В пути", Delivered: "Доставлен",
  Cancelled: "Отменён", Returned: "Возврат"
};
const STATUS_COLORS: Record<string, string> = {
  New: "bg-blue-500", UnderReview: "bg-yellow-500", Preparing: "bg-orange-500",
  Ready: "bg-emerald-500", OnTheWay: "bg-purple-500", Delivered: "bg-green-500",
  Cancelled: "bg-red-500", Returned: "bg-gray-500"
};

export default function WorkspacePage() {
  const token = useAppSelector((state) => state.auth.token);
  const role = useAppSelector((state) => state.auth.role);
  const [activeTab, setActiveTab] = useState<Tab>("pharmacy");

  useEffect(() => {
    function syncHash() {
      const h = window.location.hash.replace("#", "") as Tab;
      if (h === "offers") setActiveTab("offers");
      else if (h === "orders") setActiveTab("orders");
      else setActiveTab("pharmacy");
    }
    syncHash();
    window.addEventListener("hashchange", syncHash);
    const interval = setInterval(syncHash, 150);
    return () => { clearInterval(interval); window.removeEventListener("hashchange", syncHash); };
  }, []);

  /* Feature 14: stat cards data */
  const [orderCount, setOrderCount] = useState(0);
  const [pharmacyName, setPharmacyName] = useState("");
  const [adminIdentity, setAdminIdentity] = useState<{name: string; phoneNumber: string} | null>(null);
  const [pharmacyActive, setPharmacyActive] = useState(true);

  useEffect(() => {
    if (!token || role !== "Admin") return;
    getAdminOrders(token, "", 1, 1000)
      .then((data) => setOrderCount(data.length))
      .catch(() => undefined);
    getActivePharmacies(token)
      .then((pharmacies) => {
        if (pharmacies.length > 0) {
          setPharmacyName(pharmacies[0].title);
          setPharmacyActive(pharmacies[0].isActive ?? true);
        }
      })
      .catch(() => undefined);
    getAdminMe(token).then(setAdminIdentity).catch(() => undefined);
  }, [token, role]);

  if (!token || role !== "Admin") {
    return (
      <AppShell top={<TopBar title="Workspace" backHref="/" />}>
        <div className="stitch-card p-6 text-sm">
          Доступ только для администраторов. <Link href="/login" className="font-bold text-primary">Войти</Link>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell top={<TopBar title="Workspace" backHref="/" />}>
      <div className="space-y-4">
        {/* Feature 14: Admin hero */}
        <div className="rounded-2xl bg-gradient-to-br from-primary to-[#0070eb] p-6 text-white space-y-3">
          <p className="text-xs font-bold uppercase tracking-wider opacity-80">Admin Dashboard</p>
          <h1 className="text-2xl font-extrabold">
            Кабинет аптеки{pharmacyName ? `: ${pharmacyName}` : ""}
          </h1>
          <p className="text-sm opacity-80">Управляйте аптекой, предложениями и заказами</p>
        </div>

        {/* Feature 14: Stat cards */}
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 sm:gap-3">
          <div className="stitch-card p-4 flex sm:block items-center sm:text-center gap-3 sm:gap-0">
            <p className="text-2xl font-black text-primary">{orderCount}</p>
            <p className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">Заказы в ленте</p>
          </div>
          <div className="stitch-card p-4 flex sm:block items-center sm:text-center gap-3 sm:gap-0">
            <p className={`text-lg font-black ${pharmacyActive ? "text-emerald-600" : "text-red-600"}`}>
              {pharmacyActive ? "Активна" : "Отключена"}
            </p>
            <p className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">Статус аптеки</p>
          </div>
          <div className="stitch-card p-4 flex sm:block items-center sm:text-center gap-3 sm:gap-0">
            <p className="text-lg font-black text-primary truncate">{adminIdentity?.name || "Admin"}</p>
            <p className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">Администратор</p>
          </div>
        </div>

        {activeTab === "pharmacy" ? <PharmacyTab token={token} /> : null}
        {activeTab === "offers" ? <OffersTab token={token} /> : null}
        {activeTab === "orders" ? <OrdersTab token={token} /> : null}
      </div>
    </AppShell>
  );
}

/* ── Pharmacy Tab ── */

function PharmacyTab({ token }: { token: string }) {
  const [pharmacies, setPharmacies] = useState<ActivePharmacy[]>([]);
  const [adminName, setAdminName] = useState("");
  const [adminPhone, setAdminPhone] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const [pharmaTitle, setPharmaTitle] = useState("");
  const [pharmaAddress, setPharmaAddress] = useState("");
  const [pharmaActive, setPharmaActive] = useState(true);
  const [pharmaMsg, setPharmaMsg] = useState<string | null>(null);

  useEffect(() => {
    getActivePharmacies(token).then(setPharmacies).catch(() => undefined);
    getAdminMe(token).then((data) => {
      setAdminName(data.name || "");
      setAdminPhone(data.phoneNumber || "");
    }).catch(() => undefined);
  }, [token]);

  const pharmacy = pharmacies[0];

  useEffect(() => {
    if (pharmacy) {
      setPharmaTitle(pharmacy.title);
      setPharmaAddress(pharmacy.address);
      setPharmaActive(pharmacy.isActive ?? true);
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
    try {
      await updatePharmacy(token, { pharmacyId: pharmacy.id, title: pharmaTitle, address: pharmaAddress, isActive: pharmaActive });
      setPharmaMsg("Аптека обновлена.");
      getActivePharmacies(token).then(setPharmacies).catch(() => undefined);
    } catch (err) {
      setPharmaMsg(err instanceof Error ? err.message : "Ошибка.");
    }
  }

  return (
    <div className="grid gap-5 md:grid-cols-2">
      <form className="stitch-card space-y-4 p-6" onSubmit={onSaveAdmin}>
        <div>
          <h2 className="text-lg font-bold">Профиль администратора</h2>
          <p className="mt-1 text-sm text-on-surface-variant">Ваши контактные данные и данные для входа.</p>
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
        <form className="stitch-card space-y-4 p-6" onSubmit={onSavePharmacy}>
          <div>
            <h2 className="text-lg font-bold">Управление аптекой</h2>
            <p className="mt-1 text-sm text-on-surface-variant">Название, адрес и статус видимости для клиентов.</p>
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
          {pharmaMsg ? <div className={`rounded-xl p-3 text-sm ${pharmaMsg.includes("обновлена") ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}`}>{pharmaMsg}</div> : null}
          <button type="submit" className="stitch-button w-full">Обновить аптеку</button>
        </form>
      ) : null}
    </div>
  );
}

/* ── Offers Tab ── */

function OffersTab({ token }: { token: string }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ApiMedicine[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const doSearch = useCallback((q: string) => {
    if (!q.trim()) { setResults([]); return; }
    setIsSearching(true);
    searchMedicines(q.trim(), 80)
      .then(setResults)
      .catch(() => undefined)
      .finally(() => setIsSearching(false));
  }, []);

  function onQueryChange(value: string) {
    setQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(value), 300);
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-bold">Управление предложениями</h2>
        <p className="mt-1 text-sm text-on-surface-variant">Найдите лекарство и задайте цену и остаток для вашей аптеки.</p>
      </div>

      <input
        className="stitch-input w-full"
        placeholder="Поиск лекарств для добавления предложения..."
        value={query}
        onChange={(e) => onQueryChange(e.target.value)}
      />

      {isSearching ? <div className="text-sm text-on-surface-variant">Поиск...</div> : null}

      {results.length > 0 && !isSearching ? (
        <p className="text-xs text-on-surface-variant">{results.length} товаров найдено</p>
      ) : null}

      {results.map((medicine) => (
        <OfferCard key={medicine.id} token={token} medicine={medicine} />
      ))}
    </div>
  );
}

function OfferCard({ token, medicine }: { token: string; medicine: ApiMedicine }) {
  const [stock, setStock] = useState("");
  const [price, setPrice] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const imageUrl = resolveMedicineImageUrl(medicine);

  async function onSave(e: FormEvent) {
    e.preventDefault();
    setMsg(null);
    try {
      await upsertOffer(token, { medicineId: medicine.id, stockQuantity: Number(stock), price: Number(price) });
      setMsg("Сохранено.");
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Ошибка.");
    }
  }

  return (
    <form className="stitch-card overflow-hidden" onSubmit={onSave}>
      <div className="flex gap-4 p-4">
        <div className="h-16 w-16 flex-shrink-0 overflow-hidden rounded-xl bg-surface-container">
          {imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={imageUrl} alt={medicine.title || ""} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-[10px] text-on-surface-variant">Фото</div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-bold truncate">{medicine.title || medicine.name || medicine.id.slice(0, 8)}</p>
          {medicine.articul ? <p className="text-[10px] font-mono text-on-surface-variant">{medicine.articul}</p> : null}
        </div>
      </div>
      <div className="flex gap-2 px-4 pb-4">
        <input className="stitch-input flex-1" type="number" min="0" placeholder="Остаток" value={stock} onChange={(e) => setStock(e.target.value)} required />
        <input className="stitch-input flex-1" type="number" min="0" step="0.01" placeholder="Цена" value={price} onChange={(e) => setPrice(e.target.value)} required />
        <button type="submit" className="stitch-button">OK</button>
      </div>
      {msg ? <div className={`px-4 pb-3 text-xs ${msg === "Сохранено." ? "text-emerald-700" : "text-red-700"}`}>{msg}</div> : null}
    </form>
  );
}

/* ── Orders Tab (Kanban) ── */

function OrdersTab({ token }: { token: string }) {
  const [orders, setOrders] = useState<ApiOrder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dateFilter, setDateFilter] = useState("");

  const refresh = useCallback(() => {
    setIsLoading(true);
    getAdminOrders(token, "")
      .then((data) => { setOrders(data); setIsLoading(false); })
      .catch((err) => { setError(err instanceof Error ? err.message : "Ошибка."); setIsLoading(false); });
  }, [token]);

  useOrderStatusLive(useCallback(() => { refresh(); }, [refresh]));
  useSignalREvent("PaymentIntentUpdated", useCallback(() => { refresh(); }, [refresh]), token);

  useEffect(() => { refresh(); }, [refresh]);

  async function onAction(action: string, orderId: string) {
    try {
      if (action === "assembly") await startAssembly(token, orderId);
      if (action === "ready") await markReady(token, orderId);
      if (action === "ontheway") await markOnTheWay(token, orderId);
      if (action === "delete") await deleteNewOrder(token, orderId);
      refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка.");
    }
  }

  const filteredOrders = dateFilter
    ? orders.filter((o) => o.createdAtUtc && new Date(o.createdAtUtc).toISOString().slice(0, 10) === dateFilter)
    : orders;

  const grouped = ALL_STATUSES.reduce<Record<string, ApiOrder[]>>((acc, status) => {
    acc[status] = filteredOrders.filter((o) => o.status === status);
    return acc;
  }, {});

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold">Управление заказами</h2>
          <p className="mt-1 text-sm text-on-surface-variant">Доска заказов по всем статусам{dateFilter ? ` · ${dateFilter}` : ""}</p>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="date"
            className="stitch-input text-xs w-auto"
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
          />
          {dateFilter ? (
            <button type="button" onClick={() => setDateFilter("")} className="text-xs text-on-surface-variant hover:text-red-600">Сбросить</button>
          ) : null}
        </div>
      </div>

      {isLoading ? <div className="text-sm text-on-surface-variant">Загрузка...</div> : null}
      {error ? <div className="rounded-xl bg-red-100 p-3 text-sm text-red-700">{error}</div> : null}

      <div className="flex gap-4 overflow-x-auto pb-4 snap-x md:grid md:grid-cols-2 md:overflow-x-visible xl:grid-cols-4">
        {ALL_STATUSES.map((status) => {
          const actions = (order: ApiOrder): { label: string; action: string; danger?: boolean }[] => {
            const a: { label: string; action: string; danger?: boolean }[] = [];
            if (status === "UnderReview") a.push({ label: "Начать сборку", action: "assembly" });
            if (status === "Preparing") a.push({ label: "Собран", action: "ready" });
            if (status === "Ready") a.push({ label: order.isPickup ? "Выдан клиенту" : "В пути", action: "ontheway" });
            // New, OnTheWay, Delivered, Cancelled, Returned — no actions for admin
            return a;
          };

          return (
            <div key={status} className="min-w-[260px] flex-shrink-0 snap-start rounded-2xl bg-surface-container-low p-3 space-y-3 md:min-w-0">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className={`w-2.5 h-2.5 rounded-full ${STATUS_COLORS[status]}`} />
                  <h4 className="text-sm font-bold">{STATUS_LABELS[status]}</h4>
                </div>
                <span className="rounded-full bg-surface-container-high px-2 py-0.5 text-[10px] font-bold">{grouped[status].length}</span>
              </div>
              <div className="space-y-2 max-h-[60vh] overflow-y-auto">
                {grouped[status].map((order) => (
                  <OrderCard key={order.orderId} order={order} token={token} onRefresh={refresh} actions={actions(order)} onAction={onAction} />
                ))}
                {grouped[status].length === 0 && <p className="text-xs text-on-surface-variant text-center py-4">Пусто</p>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function OrderCard({
  order,
  actions,
  onAction,
  token,
  onRefresh
}: {
  order: ApiOrder;
  actions: { label: string; action: string; danger?: boolean }[];
  onAction: (action: string, orderId: string) => void;
  token?: string;
  onRefresh?: () => void;
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

  return (
    <div className="stitch-card space-y-2 p-3">
      <div className="flex items-center justify-between">
        <span className="font-mono text-xs text-on-surface-variant">#{order.orderId.slice(0, 8)}</span>
        <span className="font-bold text-sm">{formatMoney(order.cost, order.currency)}</span>
      </div>
      {phoneDisplay ? <p className="text-xs font-mono text-on-surface-variant">{phoneDisplay}</p> : null}

      {order.createdAtUtc ? (
        <p className="text-xs text-on-surface-variant">
          {new Date(order.createdAtUtc).toLocaleDateString("ru-RU", { day: "numeric", month: "short", year: "numeric" })}
        </p>
      ) : null}

      {order.deliveryAddress ? <p className="text-xs text-on-surface-variant">{order.isPickup ? "Самовывоз" : order.deliveryAddress}</p> : null}

      {/* Feature 13: Position count and delivery type */}
      <div className="flex items-center gap-2 text-xs text-on-surface-variant">
        <span>{order.positions?.length ?? 0} поз.</span>
        <span>{order.isPickup ? "Самовывоз" : "Доставка"}</span>
      </div>

      {/* Position list with reject checkboxes for Preparing */}
      {showPositionReject ? (
        <div className="space-y-1">
          {order.positions!.map((pos) => (
            <label key={pos.positionId} className={`flex items-center gap-2 rounded-lg px-2 py-1 text-xs ${pos.isRejected ? "line-through text-on-surface-variant" : ""}`}>
              {!pos.isRejected ? (
                <input type="checkbox" checked={selectedPositions.has(pos.positionId)} onChange={() => togglePosition(pos.positionId)} />
              ) : null}
              <span>{pos.medicine?.title ?? pos.medicineId.slice(0, 8)} × {pos.quantity}</span>
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
                if (a.danger && !confirm("Вы уверены?")) return;
                onAction(a.action, order.orderId);
              }}
            >
              {a.label}
            </button>
          ))}
        </div>
      ) : null}

      {/* Feature 13: "Подробнее" link */}
      <Link
        href={`/workspace/order/${order.orderId}`}
        className="inline-block rounded-lg bg-surface-container-low px-3 py-1 text-xs font-bold text-on-surface-variant hover:bg-surface-container-high"
      >
        Подробнее
      </Link>
    </div>
  );
}
