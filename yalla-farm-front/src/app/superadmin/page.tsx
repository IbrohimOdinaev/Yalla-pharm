"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAppSelector } from "@/shared/lib/redux";
import { formatMoney } from "@/shared/lib/format";
import { AppShell } from "@/widgets/layout/AppShell";
import { TopBar } from "@/widgets/layout/TopBar";

import { getAdmins, createAdmin, createAdminWithPharmacy, deleteAdmin, type ApiAdmin } from "@/entities/admin/api";
import { getAllPharmacies, updatePharmacy, deletePharmacy } from "@/entities/pharmacy/admin-api";
import type { ActivePharmacy } from "@/entities/pharmacy/api";
import { getAllMedicines, createMedicine, updateMedicine, deleteMedicine, uploadMedicineImage } from "@/entities/medicine/admin-api";
import { getMedicineDisplayName, getMedicineById, resolveMedicineImageUrl } from "@/entities/medicine/api";
import type { ApiMedicine, ApiOrder, ApiRefundRequest } from "@/shared/types/api";
import { getClients, deleteClient } from "@/entities/client/admin-api";
import type { ApiClient } from "@/shared/types/api";
import { getAllOrders, superAdminNextStatus } from "@/entities/order/admin-api";
import { getPendingPaymentIntents, confirmPaymentIntent, rejectPaymentIntent, type ApiPaymentIntent } from "@/entities/payment/api";
import { getRefundRequests, initiateRefund } from "@/entities/refund/api";
import { useOrderStatusLive } from "@/features/orders/model/useOrderStatusLive";
import { useSignalREvent } from "@/shared/lib/useSignalR";

type Tab = "pharmacies" | "medicines" | "orders";

export default function SuperAdminPage() {
  const token = useAppSelector((state) => state.auth.token);
  const role = useAppSelector((state) => state.auth.role);
  const [activeTab, setActiveTab] = useState<Tab>("pharmacies");

  // Sync activeTab from URL hash — poll because hashchange is unreliable with SPA
  useEffect(() => {
    function syncHash() {
      const h = window.location.hash.replace("#", "") as Tab;
      if (h === "medicines" || h === "orders") setActiveTab(h);
      else setActiveTab("pharmacies");
    }
    syncHash();
    window.addEventListener("hashchange", syncHash);
    const interval = setInterval(syncHash, 150);
    return () => { clearInterval(interval); window.removeEventListener("hashchange", syncHash); };
  }, []);

  if (!token || role !== "SuperAdmin") {
    return (
      <AppShell top={<TopBar title="SuperAdmin" backHref="/" />}>
        <div className="stitch-card p-6 text-sm">
          Доступ только для суперадминистраторов. <Link href="/login" className="font-bold text-primary">Войти</Link>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell top={<TopBar title="SuperAdmin" backHref="/" />}>
      <div className="space-y-4">
        {/* Hero */}
        <div className="rounded-2xl bg-gradient-to-br from-primary to-[#0070eb] p-6 text-white space-y-2">
          <p className="text-[10px] font-bold uppercase tracking-widest opacity-60">SuperAdmin Control</p>
          <h1 className="text-2xl font-extrabold">Глобальное управление системой</h1>
          <p className="text-sm opacity-80">Управление аптеками, каталогом, клиентами и заказами.</p>
        </div>

        {/* Stats */}
        <StatsDashboard token={token} />

        {activeTab === "pharmacies" ? <PharmaciesTab token={token} /> : null}
        {activeTab === "medicines" ? <MedicinesTab token={token} /> : null}
        {activeTab === "orders" ? <OrdersTab token={token} /> : null}
      </div>
    </AppShell>
  );
}

/* ── Stats Dashboard ── */

function StatsDashboard({ token }: { token: string }) {
  const [stats, setStats] = useState({ admins: 0, pharmacies: 0, medicines: 0, clients: 0 });

  useEffect(() => {
    Promise.all([
      getAdmins(token).then((a) => a.length),
      getAllPharmacies(token).then((p) => p.length),
      getAllMedicines(token).then((m) => m.length),
      getClients(token).then((c) => c.length)
    ])
      .then(([admins, pharmacies, medicines, clients]) => setStats({ admins, pharmacies, medicines, clients }))
      .catch(() => undefined);
  }, [token]);

  const items = [
    { label: "Админы", value: stats.admins },
    { label: "Аптеки", value: stats.pharmacies },
    { label: "Лекарства", value: stats.medicines },
    { label: "Клиенты", value: stats.clients }
  ];

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
      {items.map((item) => (
        <div key={item.label} className="stitch-card p-4 text-center">
          <p className="text-2xl font-black text-primary">{item.value}</p>
          <p className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">{item.label}</p>
        </div>
      ))}
    </div>
  );
}

/* ── Pharmacies & Admins Tab ── */

function PharmaciesTab({ token }: { token: string }) {
  const [admins, setAdmins] = useState<ApiAdmin[]>([]);
  const [pharmacies, setPharmacies] = useState<ActivePharmacy[]>([]);
  const [query, setQuery] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback((q = "") => {
    Promise.all([getAdmins(token, q), getAllPharmacies(token, q)])
      .then(([a, p]) => { setAdmins(a); setPharmacies(p); })
      .catch(() => undefined);
  }, [token]);

  useEffect(() => { load(); }, [load]);

  function onSearchChange(v: string) {
    setQuery(v);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => load(v), 300);
  }

  /* Create admin + pharmacy */
  const [newAdminName, setNewAdminName] = useState("");
  const [newAdminPhone, setNewAdminPhone] = useState("");
  const [newAdminPass, setNewAdminPass] = useState("");
  const [newPharmaTitle, setNewPharmaTitle] = useState("");
  const [newPharmaAddr, setNewPharmaAddr] = useState("");

  async function onCreateAdminPharmacy(e: FormEvent) {
    e.preventDefault();
    setMsg(null);
    try {
      await createAdminWithPharmacy(token, {
        adminName: newAdminName, adminPhoneNumber: newAdminPhone, adminPassword: newAdminPass,
        pharmacyTitle: newPharmaTitle, pharmacyAddress: newPharmaAddr
      });
      setMsg("Админ и аптека созданы.");
      setNewAdminName(""); setNewAdminPhone(""); setNewAdminPass(""); setNewPharmaTitle(""); setNewPharmaAddr("");
      load(query);
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Ошибка.");
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-bold">Управление аптеками и администраторами</h2>
        <p className="mt-1 text-sm text-on-surface-variant">Структурированный обзор, создание и изменение сущностей</p>
      </div>

      <input className="stitch-input w-full" placeholder="Поиск по аптекам и админам..." value={query} onChange={(e) => onSearchChange(e.target.value)} />

      {/* Create form */}
      <form className="stitch-card space-y-3 p-5" onSubmit={onCreateAdminPharmacy}>
        <div>
          <h3 className="font-bold">Создать админа + аптеку</h3>
          <p className="mt-0.5 text-xs text-on-surface-variant">Новый администратор с новой аптекой</p>
        </div>
        <div className="grid gap-2 md:grid-cols-2">
          <input className="stitch-input" placeholder="Имя админа" value={newAdminName} onChange={(e) => setNewAdminName(e.target.value)} required />
          <input className="stitch-input" placeholder="Телефон" value={newAdminPhone} onChange={(e) => setNewAdminPhone(e.target.value)} required />
          <input className="stitch-input" type="password" placeholder="Пароль" value={newAdminPass} onChange={(e) => setNewAdminPass(e.target.value)} required />
          <input className="stitch-input" placeholder="Название аптеки" value={newPharmaTitle} onChange={(e) => setNewPharmaTitle(e.target.value)} required />
          <input className="stitch-input md:col-span-2" placeholder="Адрес аптеки" value={newPharmaAddr} onChange={(e) => setNewPharmaAddr(e.target.value)} required />
        </div>
        {msg ? <div className={`text-sm ${msg.includes("созданы") ? "text-emerald-700" : "text-red-700"}`}>{msg}</div> : null}
        <button type="submit" className="stitch-button">Создать</button>
      </form>

      {/* Create admin in existing pharmacy */}
      <CreateAdminInPharmacyForm token={token} pharmacies={pharmacies} onDone={() => load(query)} />

      {/* Admins list */}
      <section>
        <h3 className="mb-2 text-sm font-bold uppercase tracking-wider text-on-surface-variant">Администраторы ({admins.length})</h3>
        <div className="space-y-2">
          {admins.map((admin) => (
            <div key={admin.adminId} className="stitch-card flex items-center justify-between p-3">
              <div>
                <p className="font-bold">{admin.name}</p>
                <p className="text-xs text-on-surface-variant">{admin.phoneNumber} {admin.pharmacyTitle ? `· ${admin.pharmacyTitle}` : ""}</p>
                <p className="text-[10px] text-on-surface-variant font-mono break-all">{admin.adminId}</p>
              </div>
              <button type="button" className="rounded-lg bg-red-100 px-3 py-1 text-xs font-bold text-red-700" onClick={async () => {
                if (!confirm(`Удалить админа ${admin.name}?`)) return;
                await deleteAdmin(token, admin.adminId).catch(() => undefined);
                load(query);
              }}>Удалить</button>
            </div>
          ))}
        </div>
      </section>

      {/* Pharmacies list (editable) */}
      <section>
        <h3 className="mb-2 text-sm font-bold uppercase tracking-wider text-on-surface-variant">Аптеки ({pharmacies.length})</h3>
        <div className="space-y-2">
          {pharmacies.map((p) => (
            <EditablePharmacyCard key={p.id} token={token} pharmacy={p} onDone={() => load(query)} />
          ))}
        </div>
      </section>

      {/* Clients section (merged from ClientsTab) */}
      <ClientsSection token={token} />
    </div>
  );
}

function CreateAdminInPharmacyForm({ token, pharmacies, onDone }: { token: string; pharmacies: ActivePharmacy[]; onDone: () => void }) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [pharmacyId, setPharmacyId] = useState("");
  const [msg, setMsg] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setMsg(null);
    try {
      await createAdmin(token, { name, phoneNumber: phone, password, pharmacyId: pharmacyId || undefined });
      setMsg("Админ создан.");
      setName(""); setPhone(""); setPassword(""); setPharmacyId("");
      onDone();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Ошибка.");
    }
  }

  return (
    <form className="stitch-card space-y-3 p-5" onSubmit={onSubmit}>
      <div>
        <h3 className="font-bold">Создать админа в существующую аптеку</h3>
        <p className="mt-0.5 text-xs text-on-surface-variant">Привязать нового админа к существующей аптеке</p>
      </div>
      <div className="grid gap-2 md:grid-cols-2">
        <input className="stitch-input" placeholder="Имя" value={name} onChange={(e) => setName(e.target.value)} required />
        <input className="stitch-input" placeholder="Телефон" value={phone} onChange={(e) => setPhone(e.target.value)} required />
        <input className="stitch-input" type="password" placeholder="Пароль" value={password} onChange={(e) => setPassword(e.target.value)} required />
        <select className="stitch-input" value={pharmacyId} onChange={(e) => setPharmacyId(e.target.value)}>
          <option value="">Без аптеки</option>
          {pharmacies.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
        </select>
      </div>
      {msg ? <div className={`text-sm ${msg.includes("создан") ? "text-emerald-700" : "text-red-700"}`}>{msg}</div> : null}
      <button type="submit" className="stitch-button">Создать</button>
    </form>
  );
}

function EditablePharmacyCard({ token, pharmacy, onDone }: { token: string; pharmacy: ActivePharmacy; onDone: () => void }) {
  const [isEditing, setIsEditing] = useState(false);
  const [title, setTitle] = useState(pharmacy.title);
  const [address, setAddress] = useState(pharmacy.address);
  const [isActive, setIsActive] = useState(pharmacy.isActive ?? true);
  const [msg, setMsg] = useState<string | null>(null);

  async function onSave(e: FormEvent) {
    e.preventDefault();
    setMsg(null);
    try {
      await updatePharmacy(token, { pharmacyId: pharmacy.id, title, address, isActive });
      setMsg("Обновлено.");
      setIsEditing(false);
      onDone();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Ошибка.");
    }
  }

  if (isEditing) {
    return (
      <form className="stitch-card space-y-3 p-4" onSubmit={onSave}>
        <input className="stitch-input" value={title} onChange={(e) => setTitle(e.target.value)} required />
        <input className="stitch-input" value={address} onChange={(e) => setAddress(e.target.value)} required />
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} /> Активна
        </label>
        {msg ? <div className="text-xs text-red-700">{msg}</div> : null}
        <div className="flex gap-2">
          <button type="submit" className="stitch-button text-xs">Сохранить</button>
          <button type="button" className="stitch-button-secondary text-xs" onClick={() => setIsEditing(false)}>Отмена</button>
        </div>
      </form>
    );
  }

  return (
    <div className="stitch-card flex items-center justify-between p-3">
      <div>
        <p className="font-bold">{pharmacy.title}</p>
        <p className="text-xs text-on-surface-variant">{pharmacy.address} · {pharmacy.isActive ? "Активна" : "Неактивна"}</p>
        <p className="text-[10px] text-on-surface-variant font-mono break-all">{pharmacy.id}</p>
      </div>
      <div className="flex gap-1">
        <button type="button" className="rounded-lg bg-surface-container-low px-3 py-1 text-xs font-bold" onClick={() => setIsEditing(true)}>Изменить</button>
        <button type="button" className="rounded-lg bg-red-100 px-3 py-1 text-xs font-bold text-red-700" onClick={async () => {
          if (!confirm(`Удалить аптеку ${pharmacy.title}?`)) return;
          await deletePharmacy(token, pharmacy.id).catch(() => undefined);
          onDone();
        }}>Удалить</button>
      </div>
    </div>
  );
}

/* ── Medicines Tab ── */

type StockFilter = "all" | "in-stock" | "out-of-stock";

function MedicinesTab({ token }: { token: string }) {
  const [medicines, setMedicines] = useState<ApiMedicine[]>([]);
  const [query, setQuery] = useState("");
  const [stockFilter, setStockFilter] = useState<StockFilter>("all");
  const [selected, setSelected] = useState<ApiMedicine | null>(null);
  const [selectedDetails, setSelectedDetails] = useState<ApiMedicine | null>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback((q = "") => {
    getAllMedicines(token, q).then(setMedicines).catch(() => undefined);
  }, [token]);

  useEffect(() => { load(); }, [load]);

  const filteredMedicines = useMemo(() => {
    if (stockFilter === "all") return medicines;
    return medicines.filter((m) => {
      const hasStock = (m.offers ?? []).some((o) => o.stockQuantity > 0);
      return stockFilter === "in-stock" ? hasStock : !hasStock;
    });
  }, [medicines, stockFilter]);

  /* Fetch full details when selected changes */
  useEffect(() => {
    if (!selected) { setSelectedDetails(null); return; }
    setDetailsLoading(true);
    getMedicineById(selected.id)
      .then(setSelectedDetails)
      .catch(() => setSelectedDetails(selected))
      .finally(() => setDetailsLoading(false));
  }, [selected]);

  function onSearchChange(v: string) {
    setQuery(v);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => load(v), 300);
  }

  /* Create medicine */
  const [newTitle, setNewTitle] = useState("");
  const [newArticul, setNewArticul] = useState("");
  const [newAttrs, setNewAttrs] = useState("");

  async function onCreateMedicine(e: FormEvent) {
    e.preventDefault();
    setMsg(null);
    try {
      const atributes = newAttrs.split(",").filter(Boolean).map((pair) => {
        const [name, option] = pair.split(":").map((s) => s.trim());
        return { name: name || "", option: option || "" };
      }).filter((a) => a.name);
      await createMedicine(token, { title: newTitle, articul: newArticul, atributes: atributes.length > 0 ? atributes : undefined });
      setMsg("Товар создан.");
      setNewTitle(""); setNewArticul(""); setNewAttrs("");
      load(query);
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Ошибка.");
    }
  }

  /* Upload image */
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploadIsMain, setUploadIsMain] = useState(true);
  const [uploadIsMinimal, setUploadIsMinimal] = useState(false);

  async function onUploadImage(e: FormEvent) {
    e.preventDefault();
    if (!selected || !fileRef.current?.files?.[0]) return;
    try {
      await uploadMedicineImage(token, selected.id, fileRef.current.files[0], uploadIsMain, uploadIsMinimal);
      setMsg("Изображение загружено.");
      load(query);
      // Re-fetch details to show new image
      getMedicineById(selected.id).then(setSelectedDetails).catch(() => undefined);
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Ошибка загрузки.");
    }
  }

  const detail = selectedDetails ?? selected;
  const imageUrl = detail ? resolveMedicineImageUrl(detail) : "";

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_1.2fr]">
      {/* Left column - list */}
      <div className="space-y-5">
        <div>
          <h2 className="text-lg font-bold">Управление каталогом товаров</h2>
          <p className="mt-1 text-sm text-on-surface-variant">Создание, поиск, редактирование и управление изображениями.</p>
        </div>

        {/* Create */}
        <form className="stitch-card space-y-3 p-5" onSubmit={onCreateMedicine}>
          <h3 className="font-bold">Создать товар</h3>
          <div className="grid gap-2">
            <input className="stitch-input" placeholder="Название" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} required />
            <input className="stitch-input" placeholder="Артикул" value={newArticul} onChange={(e) => setNewArticul(e.target.value)} required />
            <input className="stitch-input" placeholder="Атрибуты (dosage:500mg, pack:20)" value={newAttrs} onChange={(e) => setNewAttrs(e.target.value)} />
          </div>
          {msg ? <div className={`text-sm ${msg.includes("создан") || msg.includes("загружено") ? "text-emerald-700" : "text-red-700"}`}>{msg}</div> : null}
          <button type="submit" className="stitch-button">Создать</button>
        </form>

        {/* Search */}
        <input className="stitch-input w-full" placeholder="Поиск лекарств..." value={query} onChange={(e) => onSearchChange(e.target.value)} />

        {/* Stock filter */}
        <div className="flex gap-2">
          {([
            { id: "all" as StockFilter, label: "Все" },
            { id: "in-stock" as StockFilter, label: "В наличии" },
            { id: "out-of-stock" as StockFilter, label: "Нет в наличии" },
          ]).map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setStockFilter(f.id)}
              className={`rounded-full px-3 py-1.5 text-xs font-bold transition ${
                stockFilter === f.id ? "bg-primary text-white" : "bg-surface-container-low text-on-surface-variant"
              }`}
            >
              {f.label}
            </button>
          ))}
          <span className="ml-auto text-xs text-on-surface-variant self-center">{filteredMedicines.length} из {medicines.length}</span>
        </div>

        {/* List */}
        <div className="grid gap-3 md:grid-cols-2">
          {filteredMedicines.map((m) => (
            <button
              key={m.id}
              type="button"
              className={`stitch-card overflow-hidden text-left transition ${selected?.id === m.id ? "ring-2 ring-primary" : ""}`}
              onClick={() => setSelected(m)}
            >
              <div className="flex gap-3 p-3">
                <div className="h-12 w-12 flex-shrink-0 overflow-hidden rounded-lg bg-surface-container">
                  {resolveMedicineImageUrl(m) ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={resolveMedicineImageUrl(m)} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-[10px] text-on-surface-variant">&mdash;</div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-sm truncate">{getMedicineDisplayName(m)}</p>
                  {m.articul ? <p className="text-[10px] font-mono text-on-surface-variant">{m.articul}</p> : null}
                  <span className={`inline-block mt-1 rounded-full px-1.5 py-0.5 text-[9px] font-bold ${m.isActive === false ? "bg-red-100 text-red-700" : "bg-emerald-100 text-emerald-800"}`}>
                    {m.isActive === false ? "Скрыт" : "В каталоге"}
                  </span>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Right column - details */}
      {selected && detail ? (
        <div className="stitch-card space-y-5 p-5">
          {detailsLoading ? (
            <div className="text-sm text-on-surface-variant">Загрузка...</div>
          ) : (
            <>
              {/* Image preview */}
              {imageUrl ? (
                <div className="overflow-hidden rounded-xl bg-surface-container-low">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={imageUrl} alt={getMedicineDisplayName(detail)} className="mx-auto max-h-64 object-contain" />
                </div>
              ) : (
                <div className="flex h-40 items-center justify-center rounded-xl bg-surface-container-low text-sm text-on-surface-variant">
                  Нет изображения
                </div>
              )}

              {/* Title, articul, status, ID */}
              <div className="space-y-1">
                <h3 className="text-lg font-bold">{getMedicineDisplayName(detail)}</h3>
                {detail.articul ? <p className="text-sm text-on-surface-variant">Артикул: {detail.articul}</p> : null}
                <div className="flex items-center gap-2">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${detail.isActive !== false ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-700"}`}>
                    {detail.isActive !== false ? "Активный" : "Неактивный"}
                  </span>
                </div>
                <p className="text-[10px] text-on-surface-variant font-mono break-all">ID: {detail.id}</p>
              </div>

              {/* Attributes */}
              {detail.atributes && detail.atributes.length > 0 ? (
                <div>
                  <h4 className="mb-2 text-sm font-bold uppercase tracking-wider text-on-surface-variant">Атрибуты</h4>
                  <div className="flex flex-wrap gap-2">
                    {detail.atributes.map((attr, i) => (
                      <span key={i} className="rounded-full bg-surface-container-low px-3 py-1 text-xs font-medium">
                        {attr.name}: {attr.option}
                      </span>
                    ))}
                  </div>
                </div>
              ) : null}

              {/* Pharmacy offers */}
              {detail.offers && detail.offers.length > 0 ? (
                <div>
                  <h4 className="mb-2 text-sm font-bold uppercase tracking-wider text-on-surface-variant">Предложения аптек ({detail.offers.length})</h4>
                  <div className="space-y-2">
                    {detail.offers.map((offer, i) => (
                      <div key={i} className="flex items-center justify-between rounded-xl bg-surface-container-low p-3 text-sm">
                        <span className="font-medium">{offer.pharmacyTitle ?? offer.pharmacyId.slice(0, 8)}</span>
                        <div className="flex items-center gap-3 text-xs">
                          <span className="text-on-surface-variant">Остаток: {offer.stockQuantity}</span>
                          <span className="font-bold">{formatMoney(offer.price)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              {/* Edit medicine */}
              <div>
                <h4 className="mb-2 text-sm font-bold uppercase tracking-wider text-on-surface-variant">Редактирование</h4>
                <EditMedicineForm token={token} medicine={detail} onDone={() => {
                  load(query);
                  getMedicineById(detail.id).then(setSelectedDetails).catch(() => undefined);
                }} />
              </div>

              {/* Upload image */}
              <div>
                <h4 className="mb-2 text-sm font-bold uppercase tracking-wider text-on-surface-variant">Загрузка изображения</h4>
                <form className="space-y-3" onSubmit={onUploadImage}>
                  <div className="flex gap-4">
                    <label className="flex items-center gap-2 text-sm">
                      <input type="checkbox" checked={uploadIsMain} onChange={e => setUploadIsMain(e.target.checked)} />
                      Основное фото
                    </label>
                    <label className="flex items-center gap-2 text-sm">
                      <input type="checkbox" checked={uploadIsMinimal} onChange={e => setUploadIsMinimal(e.target.checked)} />
                      Миниатюра
                    </label>
                  </div>
                  <div className="flex gap-2">
                    <input ref={fileRef} type="file" accept="image/*" className="stitch-input flex-1" required />
                    <button type="submit" className="stitch-button">Загрузить</button>
                  </div>
                </form>
              </div>

              {/* Actions */}
              <div className="flex gap-2">
                <button type="button" className="rounded-xl bg-yellow-100 px-4 py-2 text-sm font-bold text-yellow-800" onClick={async () => {
                  await deleteMedicine(token, selected.id, false).catch(() => undefined);
                  setSelected(null); load(query);
                }}>Деактивировать</button>
                <button type="button" className="rounded-xl bg-red-100 px-4 py-2 text-sm font-bold text-red-700" onClick={async () => {
                  if (!confirm("Удалить товар полностью?")) return;
                  await deleteMedicine(token, selected.id, true).catch(() => undefined);
                  setSelected(null); load(query);
                }}>Удалить полностью</button>
              </div>
            </>
          )}
        </div>
      ) : (
        <div className="stitch-card p-8 text-center text-on-surface-variant">
          Выберите товар из списка
        </div>
      )}
    </div>
  );
}

function EditMedicineForm({ token, medicine, onDone }: { token: string; medicine: ApiMedicine; onDone: () => void }) {
  const [title, setTitle] = useState(medicine.title ?? "");
  const [articul, setArticul] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setIsSaving(true);
    setMsg(null);
    try {
      await updateMedicine(token, { medicineId: medicine.id, title, articul });
      setMsg("Товар обновлён.");
      onDone();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Ошибка.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <form className="space-y-2" onSubmit={onSubmit}>
      <div className="grid gap-2 md:grid-cols-2">
        <input className="stitch-input" placeholder="Название" value={title} onChange={(e) => setTitle(e.target.value)} required />
        <input className="stitch-input" placeholder="Артикул" value={articul} onChange={(e) => setArticul(e.target.value)} required />
      </div>
      {msg ? <div className={`text-xs ${msg.includes("обновлён") ? "text-emerald-700" : "text-red-700"}`}>{msg}</div> : null}
      <button type="submit" className="stitch-button text-xs" disabled={isSaving}>{isSaving ? "Сохраняем..." : "Обновить товар"}</button>
    </form>
  );
}

/* ── Clients Section (embedded in PharmaciesTab) ── */

function ClientsSection({ token }: { token: string }) {
  const [clients, setClients] = useState<ApiClient[]>([]);
  const [query, setQuery] = useState("");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback((q = "") => {
    getClients(token, q).then(setClients).catch(() => undefined);
  }, [token]);

  useEffect(() => { load(); }, [load]);

  function onSearchChange(v: string) {
    setQuery(v);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => load(v), 300);
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-bold">Клиентский реестр</h2>
        <p className="mt-1 text-sm text-on-surface-variant">Просмотр клиентов и управление аккаунтами. История заказов сохраняется при удалении.</p>
      </div>

      <input className="stitch-input w-full" placeholder="Поиск клиентов..." value={query} onChange={(e) => onSearchChange(e.target.value)} />

      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-bold uppercase tracking-wider text-on-surface-variant">Клиенты</h3>
        <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-bold text-primary">{clients.length}</span>
      </div>

      <div className="space-y-2">
        {clients.map((client) => (
          <div key={client.clientId} className="stitch-card flex items-center justify-between p-3">
            <div>
              <p className="font-bold">{client.name}</p>
              <p className="text-xs text-on-surface-variant">{client.phoneNumber}</p>
              <p className="text-[10px] text-on-surface-variant font-mono break-all">{client.clientId}</p>
            </div>
            <button type="button" className="rounded-lg bg-red-100 px-3 py-1 text-xs font-bold text-red-700" onClick={async () => {
              if (!confirm(`Удалить клиента ${client.name}?`)) return;
              await deleteClient(token, client.clientId).catch(() => undefined);
              load(query);
            }}>Удалить</button>
          </div>
        ))}
        {clients.length === 0 ? <div className="text-sm text-on-surface-variant">Нет клиентов.</div> : null}
      </div>
    </div>
  );
}

/* ── Orders + Payment Intents + Refunds Tab (Kanban) ── */

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

function OrdersTab({ token }: { token: string }) {
  const [orders, setOrders] = useState<ApiOrder[]>([]);
  const [intents, setIntents] = useState<ApiPaymentIntent[]>([]);
  const [refunds, setRefunds] = useState<ApiRefundRequest[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [dateFilter, setDateFilter] = useState("");
  const [selectedOrder, setSelectedOrder] = useState<ApiOrder | null>(null);

  const load = useCallback(() => {
    Promise.all([getAllOrders(token, ""), getPendingPaymentIntents(token), getRefundRequests(token)])
      .then(([o, i, r]) => { setOrders(o); setIntents(i); setRefunds(r); })
      .catch((err) => setError(err instanceof Error ? err.message : "Ошибка."));
  }, [token]);

  useOrderStatusLive(useCallback(() => { load(); }, [load]));

  // Also reload when payment intents change (confirm/reject)
  useSignalREvent("PaymentIntentUpdated", useCallback(() => { load(); }, [load]), token);

  useEffect(() => { load(); }, [load]);

  const filteredOrders = dateFilter
    ? orders.filter((o) => o.createdAtUtc && new Date(o.createdAtUtc).toISOString().slice(0, 10) === dateFilter)
    : orders;

  const grouped = ALL_STATUSES.reduce<Record<string, ApiOrder[]>>((acc, status) => {
    acc[status] = filteredOrders.filter((o) => o.status === status);
    return acc;
  }, {});

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold">Управление заказами</h2>
          <p className="mt-1 text-sm text-on-surface-variant">Контроль статусов и подтверждение оплат{dateFilter ? ` · ${dateFilter}` : ""}</p>
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

      {error ? <div className="rounded-xl bg-red-100 p-3 text-sm text-red-700">{error}</div> : null}

      {/* Refunds section */}
      {refunds.length > 0 ? (
        <section className="stitch-card space-y-3 p-5 opacity-80">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-on-surface-variant">Запросы на возврат</h3>
            <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-bold text-gray-600">{refunds.length}</span>
          </div>
          <div className="space-y-2">
            {refunds.map((refund) => (
              <div key={refund.refundRequestId} className="flex items-center justify-between rounded-xl bg-surface-container-low p-3 text-sm">
                <div>
                  <span className="font-bold">{formatMoney(refund.amount, refund.currency)}</span>
                  <p className="text-xs text-on-surface-variant">{refund.reason ?? "Без причины"}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${refund.status === "Completed" ? "bg-emerald-100 text-emerald-800" : "bg-yellow-100 text-yellow-800"}`}>{refund.status}</span>
                  {refund.status !== "Completed" && refund.status !== "Failed" ? (
                    <button type="button" className="stitch-button text-xs" onClick={async () => {
                      await initiateRefund(token, refund.refundRequestId).catch(() => undefined);
                      load();
                    }}>Возврат</button>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {/* Kanban columns */}
      <section>
        <h3 className="mb-3 text-sm font-bold uppercase tracking-wider text-on-surface-variant">Заказы ({filteredOrders.length})</h3>
        <div className="flex gap-4 overflow-x-auto pb-4">
          {ALL_STATUSES.map(status => {
            const statusOrders = grouped[status];
            // Show payment intents in the New column
            const showIntentsHere = status === "New";
            return (
              <div key={status} className="min-w-[260px] sm:min-w-[280px] flex-shrink-0 rounded-2xl bg-surface-container-low p-3 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={`w-2.5 h-2.5 rounded-full ${STATUS_COLORS[status]}`} />
                    <h4 className="text-sm font-bold">{STATUS_LABELS[status]}</h4>
                  </div>
                  <span className="rounded-full bg-surface-container-high px-2 py-0.5 text-[10px] font-bold">
                    {statusOrders.length + (showIntentsHere ? intents.length : 0)}
                  </span>
                </div>
                <div className="space-y-2 max-h-[60vh] overflow-y-auto">
                  {/* Payment intents as pending cards in New column */}
                  {showIntentsHere && intents.map((intent) => (
                    <PaymentIntentCard key={intent.paymentIntentId} token={token} intent={intent} onDone={load} />
                  ))}
                  {/* Orders */}
                  {statusOrders.map(order => {
                    const phone = order.clientPhoneNumber?.replace(/^\+?992/, "") ?? "";
                    return (
                      <div key={order.orderId} className="stitch-card p-3 cursor-pointer hover:ring-1 hover:ring-primary transition" onClick={() => setSelectedOrder(order)}>
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] text-on-surface-variant font-mono">#{order.orderId.slice(0, 8)}</span>
                          {phone ? <span className="text-[10px] font-mono text-on-surface-variant">{phone}</span> : null}
                        </div>
                        <div className="flex items-center justify-between text-sm mt-1">
                          <span className="truncate max-w-[140px]">{order.pharmacyTitle ?? "—"}</span>
                          <span className="font-bold">{formatMoney(order.cost, order.currency)}</span>
                        </div>
                        {order.createdAtUtc ? <p className="text-[10px] text-on-surface-variant mt-0.5">{new Date(order.createdAtUtc).toLocaleDateString("ru-RU")}</p> : null}
                      </div>
                    );
                  })}
                  {statusOrders.length === 0 && (!showIntentsHere || intents.length === 0) && (
                    <p className="text-xs text-on-surface-variant text-center py-4">Пусто</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Order detail overlay */}
      {selectedOrder ? (
        <div className="fixed inset-0 z-50 bg-on-surface/50 flex items-start justify-center p-4 pt-16 overflow-y-auto" onClick={() => setSelectedOrder(null)}>
          <div className="stitch-card w-full max-w-2xl p-6 space-y-5" onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-mono text-on-surface-variant">#{selectedOrder.orderId.slice(0, 8)}</p>
                <h2 className="text-xl font-extrabold">Заказ</h2>
              </div>
              <button type="button" onClick={() => setSelectedOrder(null)} className="rounded-xl bg-surface-container-low p-2 hover:bg-surface-container-high">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>

            {/* Order info grid */}
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 sm:gap-3 text-sm">
              <div className="rounded-xl bg-surface-container-low p-3">
                <p className="text-[10px] text-on-surface-variant uppercase">Статус</p>
                <p className="font-bold">{STATUS_LABELS[selectedOrder.status] ?? selectedOrder.status}</p>
              </div>
              <div className="rounded-xl bg-surface-container-low p-3">
                <p className="text-[10px] text-on-surface-variant uppercase">Сумма</p>
                <p className="font-bold text-primary">{formatMoney(selectedOrder.cost, selectedOrder.currency)}</p>
              </div>
              <div className="rounded-xl bg-surface-container-low p-3">
                <p className="text-[10px] text-on-surface-variant uppercase">Доставка</p>
                <p className="font-bold">{selectedOrder.isPickup ? "Самовывоз" : selectedOrder.deliveryAddress || "—"}</p>
              </div>
              <div className="rounded-xl bg-surface-container-low p-3">
                <p className="text-[10px] text-on-surface-variant uppercase">Дата</p>
                <p className="font-bold">{selectedOrder.createdAtUtc ? new Date(selectedOrder.createdAtUtc).toLocaleString("ru-RU") : "—"}</p>
              </div>
              {selectedOrder.clientPhoneNumber ? (
                <div className="rounded-xl bg-surface-container-low p-3">
                  <p className="text-[10px] text-on-surface-variant uppercase">Клиент</p>
                  <p className="font-bold font-mono">{selectedOrder.clientPhoneNumber}</p>
                </div>
              ) : null}
              {selectedOrder.pharmacyTitle || selectedOrder.pharmacyId ? (
                <div className="rounded-xl bg-surface-container-low p-3">
                  <p className="text-[10px] text-on-surface-variant uppercase">Аптека</p>
                  <p className="font-bold">{selectedOrder.pharmacyTitle || selectedOrder.pharmacyId?.slice(0, 8)}</p>
                </div>
              ) : null}
              {selectedOrder.paymentState ? (
                <div className="rounded-xl bg-surface-container-low p-3">
                  <p className="text-[10px] text-on-surface-variant uppercase">Оплата</p>
                  <p className={`font-bold ${selectedOrder.paymentState === "Confirmed" ? "text-emerald-600" : "text-yellow-600"}`}>
                    {selectedOrder.paymentState === "Confirmed" ? "Подтверждена" : selectedOrder.paymentState === "PendingManualConfirmation" ? "Ожидает" : selectedOrder.paymentState}
                  </p>
                </div>
              ) : null}
              {selectedOrder.returnCost && selectedOrder.returnCost > 0 ? (
                <div className="rounded-xl bg-surface-container-low p-3">
                  <p className="text-[10px] text-on-surface-variant uppercase">Возврат</p>
                  <p className="font-bold text-red-600">{formatMoney(selectedOrder.returnCost, selectedOrder.currency)}</p>
                </div>
              ) : null}
            </div>

            {/* Positions as mini-cards */}
            {(selectedOrder.positions ?? []).length > 0 ? (
              <div className="space-y-2">
                <h3 className="text-sm font-bold uppercase tracking-wider text-on-surface-variant">Позиции ({selectedOrder.positions!.length})</h3>
                {selectedOrder.positions!.map(pos => (
                  <Link
                    key={pos.positionId}
                    href={pos.medicineId ? `/product/${pos.medicineId}` : "#"}
                    className="flex items-center gap-3 rounded-xl bg-surface-container-low p-3 transition hover:bg-surface-container-high"
                    onClick={() => setSelectedOrder(null)}
                  >
                    <div className="h-12 w-12 flex-shrink-0 rounded-lg bg-surface-container flex items-center justify-center text-xs text-on-surface-variant font-bold">
                      {(pos.medicine?.title ?? "?")[0]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold truncate">{pos.medicine?.title ?? pos.medicineId?.slice(0, 8) ?? "Товар"}</p>
                      <div className="flex items-center gap-2 text-xs text-on-surface-variant">
                        <span>{pos.quantity} шт.</span>
                        <span>&times;</span>
                        <span className="font-bold text-primary">{formatMoney(pos.price)}</span>
                      </div>
                    </div>
                    {pos.isRejected ? <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-700">Отклонено</span> : null}
                  </Link>
                ))}
              </div>
            ) : null}

            {/* SuperAdmin can only advance: New→UnderReview, OnTheWay→Delivered */}
            {(selectedOrder.status === "New" || selectedOrder.status === "OnTheWay") ? (
              <button type="button" className="stitch-button w-full" onClick={async () => {
                await superAdminNextStatus(token, selectedOrder.orderId).catch(() => undefined);
                load();
                setSelectedOrder(null);
              }}>{selectedOrder.status === "New" ? "Подтвердить и передать аптеке" : "Подтвердить доставку"}</button>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function PaymentIntentCard({ token, intent, onDone }: { token: string; intent: ApiPaymentIntent; onDone: () => void }) {
  const [showReject, setShowReject] = useState(false);
  const [reason, setReason] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const INTENT_STATES: Record<number, string> = { 0: "Создан", 1: "Ожидает подтверждения", 2: "Подтверждён", 3: "Отклонён", 4: "Требует решения" };

  return (
    <div className="stitch-card space-y-2 p-4 ring-1 ring-yellow-300">
      <div className="flex items-center justify-between">
        <span className="rounded-full bg-yellow-100 px-2 py-0.5 text-[10px] font-bold text-yellow-800">
          {intent.state != null ? (INTENT_STATES[intent.state] ?? `State ${intent.state}`) : "Ожидает"}
        </span>
        <span className="font-bold">{formatMoney(intent.amount, intent.currency)}</span>
      </div>
      {intent.clientPhone ? <p className="text-xs text-on-surface-variant">Клиент: {intent.clientPhone}</p> : null}
      {intent.reservedOrderId ? (
        <p className="text-[10px] font-mono text-on-surface-variant">Заказ: {intent.reservedOrderId.slice(0, 8)}</p>
      ) : null}
      <p className="text-[10px] font-mono text-on-surface-variant/50 break-all">{intent.paymentIntentId}</p>

      {actionError ? <div className="rounded-lg bg-red-100 px-3 py-2 text-xs text-red-700">{actionError}</div> : null}

      {!showReject ? (
        <div className="flex gap-2">
          <button type="button" className="stitch-button text-xs" disabled={isProcessing} onClick={async () => {
            setIsProcessing(true); setActionError(null);
            try {
              await confirmPaymentIntent(token, intent.paymentIntentId);
              // After confirm, order is created with status New — advance to UnderReview
              if (intent.reservedOrderId) {
                await superAdminNextStatus(token, intent.reservedOrderId).catch(() => undefined);
              }
              onDone();
            }
            catch (err) { setActionError(err instanceof Error ? err.message : "Ошибка подтверждения"); }
            finally { setIsProcessing(false); }
          }}>{isProcessing ? "..." : "Подтвердить"}</button>
          <button type="button" className="rounded-lg bg-red-100 px-3 py-1 text-xs font-bold text-red-700" onClick={() => setShowReject(true)}>Отклонить</button>
        </div>
      ) : (
        <div className="space-y-2">
          <input className="stitch-input w-full" placeholder="Причина отклонения..." value={reason} onChange={(e) => setReason(e.target.value)} />
          <div className="flex gap-2">
            <button type="button" className="rounded-lg bg-red-600 px-3 py-1 text-xs font-bold text-white" disabled={isProcessing} onClick={async () => {
              setIsProcessing(true); setActionError(null);
              try { await rejectPaymentIntent(token, intent.paymentIntentId, reason); onDone(); }
              catch (err) { setActionError(err instanceof Error ? err.message : "Ошибка отклонения"); }
              finally { setIsProcessing(false); }
            }}>{isProcessing ? "..." : "Отклонить"}</button>
            <button type="button" className="stitch-button-secondary text-xs" onClick={() => setShowReject(false)}>Отмена</button>
          </div>
        </div>
      )}
    </div>
  );
}

