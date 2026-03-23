"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { useAppSelector } from "@/shared/lib/redux";
import { formatMoney, formatPhone } from "@/shared/lib/format";
import { AppShell } from "@/widgets/layout/AppShell";
import { TopBar } from "@/widgets/layout/TopBar";

import { updateAdminMe } from "@/entities/admin/api";
import { getActivePharmacies, type ActivePharmacy } from "@/entities/pharmacy/api";
import { updatePharmacy } from "@/entities/pharmacy/admin-api";
import { searchMedicines } from "@/entities/medicine/api";
import type { ApiMedicine, ApiOrder } from "@/shared/types/api";
import { upsertOffer } from "@/entities/offer/api";
import { getAdminOrders, startAssembly, markReady, markOnTheWay, deleteNewOrder, rejectPositions } from "@/entities/order/admin-api";

type Tab = "pharmacy" | "offers" | "orders";

const TABS: { id: Tab; label: string }[] = [
  { id: "pharmacy", label: "Аптека" },
  { id: "offers", label: "Предложения" },
  { id: "orders", label: "Заказы" }
];

const KANBAN_COLUMNS = ["UnderReview", "Preparing", "Ready", "OnTheWay"] as const;
const COLUMN_LABELS: Record<string, string> = {
  UnderReview: "На рассмотрении",
  Preparing: "Собирается",
  Ready: "Готов",
  OnTheWay: "В пути"
};

export default function WorkspacePage() {
  const token = useAppSelector((state) => state.auth.token);
  const role = useAppSelector((state) => state.auth.role);
  const [activeTab, setActiveTab] = useState<Tab>("pharmacy");

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
        {/* Tab bar */}
        <nav className="flex gap-2 overflow-x-auto">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`whitespace-nowrap rounded-xl px-4 py-2 text-sm font-bold transition ${
                activeTab === tab.id ? "bg-primary text-white" : "bg-surface-container-low text-on-surface-variant hover:bg-surface-container-high"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>

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
    <div className="space-y-5">
      <form className="stitch-card space-y-4 p-6" onSubmit={onSaveAdmin}>
        <h2 className="text-lg font-bold">Профиль администратора</h2>
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
          <h2 className="text-lg font-bold">Настройки аптеки</h2>
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
      <input
        className="stitch-input w-full"
        placeholder="Поиск лекарств для добавления предложения..."
        value={query}
        onChange={(e) => onQueryChange(e.target.value)}
      />

      {isSearching ? <div className="text-sm text-on-surface-variant">Поиск...</div> : null}

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
    <form className="stitch-card space-y-3 p-4" onSubmit={onSave}>
      <p className="font-bold">{medicine.title || medicine.name || medicine.id.slice(0, 8)}</p>
      <div className="flex gap-2">
        <input className="stitch-input flex-1" type="number" min="0" placeholder="Кол-во" value={stock} onChange={(e) => setStock(e.target.value)} required />
        <input className="stitch-input flex-1" type="number" min="0" step="0.01" placeholder="Цена" value={price} onChange={(e) => setPrice(e.target.value)} required />
        <button type="submit" className="stitch-button">OK</button>
      </div>
      {msg ? <div className={`text-xs ${msg === "Сохранено." ? "text-emerald-700" : "text-red-700"}`}>{msg}</div> : null}
    </form>
  );
}

/* ── Orders Tab (Kanban) ── */

function OrdersTab({ token }: { token: string }) {
  const [orders, setOrders] = useState<ApiOrder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(() => {
    setIsLoading(true);
    getAdminOrders(token)
      .then((data) => { setOrders(data); setIsLoading(false); })
      .catch((err) => { setError(err instanceof Error ? err.message : "Ошибка."); setIsLoading(false); });
  }, [token]);

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

  const grouped = KANBAN_COLUMNS.reduce<Record<string, ApiOrder[]>>((acc, col) => {
    acc[col] = orders.filter((o) => o.status === col);
    return acc;
  }, {});

  // Also include New orders at top
  const newOrders = orders.filter((o) => o.status === "New");

  return (
    <div className="space-y-4">
      {isLoading ? <div className="text-sm text-on-surface-variant">Загрузка...</div> : null}
      {error ? <div className="rounded-xl bg-red-100 p-3 text-sm text-red-700">{error}</div> : null}

      {/* New orders */}
      {newOrders.length > 0 ? (
        <section>
          <h3 className="mb-2 text-sm font-bold uppercase tracking-wider text-on-surface-variant">Новые</h3>
          <div className="space-y-2">
            {newOrders.map((order) => (
              <OrderCard key={order.orderId} order={order} token={token} onRefresh={refresh} actions={[
                { label: "Начать сборку", action: "assembly" },
                { label: "Удалить", action: "delete", danger: true }
              ]} onAction={onAction} />
            ))}
          </div>
        </section>
      ) : null}

      {/* Kanban columns */}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {KANBAN_COLUMNS.map((col) => (
          <section key={col} className="rounded-xl bg-surface-container-low p-3">
            <h3 className="mb-3 text-sm font-bold uppercase tracking-wider text-on-surface-variant">{COLUMN_LABELS[col]}</h3>
            <div className="space-y-2">
              {(grouped[col] ?? []).map((order) => {
                const actions: { label: string; action: string; danger?: boolean }[] = [];
                if (col === "UnderReview") actions.push({ label: "Собирается", action: "assembly" });
                if (col === "Preparing") actions.push({ label: "Готов", action: "ready" });
                if (col === "Ready") actions.push({ label: "В пути", action: "ontheway" });
                return <OrderCard key={order.orderId} order={order} token={token} onRefresh={refresh} actions={actions} onAction={onAction} />;
              })}
              {(grouped[col] ?? []).length === 0 ? <p className="text-xs text-on-surface-variant">Пусто</p> : null}
            </div>
          </section>
        ))}
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

  return (
    <div className="stitch-card space-y-2 p-3">
      <div className="flex items-center justify-between">
        <span className="font-mono text-xs text-on-surface-variant">#{order.orderId.slice(0, 8)}</span>
        <span className="font-bold text-sm">{formatMoney(order.cost, order.currency)}</span>
      </div>
      {order.deliveryAddress ? <p className="text-xs text-on-surface-variant">{order.isPickup ? "Самовывоз" : order.deliveryAddress}</p> : null}

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
      ) : (order.positions ?? []).length > 0 ? (
        <p className="text-xs text-on-surface-variant">{order.positions!.length} поз.</p>
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
    </div>
  );
}
