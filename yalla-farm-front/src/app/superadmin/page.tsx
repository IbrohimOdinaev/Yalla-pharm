"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { useAppSelector } from "@/shared/lib/redux";
import { formatMoney } from "@/shared/lib/format";
import { AppShell } from "@/widgets/layout/AppShell";
import { TopBar } from "@/widgets/layout/TopBar";

import { getAdmins, createAdmin, createAdminWithPharmacy, deleteAdmin, type ApiAdmin } from "@/entities/admin/api";
import { getAllPharmacies, updatePharmacy, deletePharmacy } from "@/entities/pharmacy/admin-api";
import type { ActivePharmacy } from "@/entities/pharmacy/api";
import { getAllMedicines, createMedicine, updateMedicine, deleteMedicine, uploadMedicineImage } from "@/entities/medicine/admin-api";
import { getMedicineDisplayName } from "@/entities/medicine/api";
import type { ApiMedicine, ApiOrder, ApiRefundRequest } from "@/shared/types/api";
import { getClients, deleteClient } from "@/entities/client/admin-api";
import type { ApiClient } from "@/shared/types/api";
import { getAllOrders, superAdminNextStatus } from "@/entities/order/admin-api";
import { getPendingPaymentIntents, confirmPaymentIntent, rejectPaymentIntent, type ApiPaymentIntent } from "@/entities/payment/api";
import { getRefundRequests, initiateRefund } from "@/entities/refund/api";

type Tab = "pharmacies" | "medicines" | "clients" | "orders" | "refunds";

const TABS: { id: Tab; label: string }[] = [
  { id: "pharmacies", label: "Аптеки" },
  { id: "medicines", label: "Лекарства" },
  { id: "clients", label: "Клиенты" },
  { id: "orders", label: "Заказы" },
  { id: "refunds", label: "Возвраты" }
];

export default function SuperAdminPage() {
  const token = useAppSelector((state) => state.auth.token);
  const role = useAppSelector((state) => state.auth.role);
  const [activeTab, setActiveTab] = useState<Tab>("pharmacies");

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

        <StatsDashboard token={token} />

        {activeTab === "pharmacies" ? <PharmaciesTab token={token} /> : null}
        {activeTab === "medicines" ? <MedicinesTab token={token} /> : null}
        {activeTab === "clients" ? <ClientsTab token={token} /> : null}
        {activeTab === "orders" ? <OrdersTab token={token} /> : null}
        {activeTab === "refunds" ? <RefundsTab token={token} /> : null}
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
      <input className="stitch-input w-full" placeholder="Поиск по аптекам и админам..." value={query} onChange={(e) => onSearchChange(e.target.value)} />

      {/* Create form */}
      <form className="stitch-card space-y-3 p-5" onSubmit={onCreateAdminPharmacy}>
        <h3 className="font-bold">Создать админа + аптеку</h3>
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
      <h3 className="font-bold">Создать админа в существующую аптеку</h3>
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

function MedicinesTab({ token }: { token: string }) {
  const [medicines, setMedicines] = useState<ApiMedicine[]>([]);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<ApiMedicine | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback((q = "") => {
    getAllMedicines(token, q).then(setMedicines).catch(() => undefined);
  }, [token]);

  useEffect(() => { load(); }, [load]);

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

  async function onUploadImage(e: FormEvent) {
    e.preventDefault();
    if (!selected || !fileRef.current?.files?.[0]) return;
    try {
      await uploadMedicineImage(token, selected.id, fileRef.current.files[0], true, false);
      setMsg("Изображение загружено.");
      load(query);
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Ошибка загрузки.");
    }
  }

  return (
    <div className="space-y-5">
      {/* Create */}
      <form className="stitch-card space-y-3 p-5" onSubmit={onCreateMedicine}>
        <h3 className="font-bold">Создать товар</h3>
        <div className="grid gap-2 md:grid-cols-3">
          <input className="stitch-input" placeholder="Название" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} required />
          <input className="stitch-input" placeholder="Артикул" value={newArticul} onChange={(e) => setNewArticul(e.target.value)} required />
          <input className="stitch-input" placeholder="Атрибуты (dosage:500mg, pack:20)" value={newAttrs} onChange={(e) => setNewAttrs(e.target.value)} />
        </div>
        {msg ? <div className={`text-sm ${msg.includes("создан") || msg.includes("загружено") ? "text-emerald-700" : "text-red-700"}`}>{msg}</div> : null}
        <button type="submit" className="stitch-button">Создать</button>
      </form>

      {/* Search */}
      <input className="stitch-input w-full" placeholder="Поиск лекарств..." value={query} onChange={(e) => onSearchChange(e.target.value)} />

      {/* List */}
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {medicines.map((m) => (
          <button key={m.id} type="button" className={`stitch-card p-3 text-left transition ${selected?.id === m.id ? "ring-2 ring-primary" : ""}`} onClick={() => setSelected(m)}>
            <p className="font-bold">{getMedicineDisplayName(m)}</p>
            <p className="text-xs text-on-surface-variant font-mono">{m.id.slice(0, 8)}</p>
          </button>
        ))}
      </div>

      {/* Selected medicine details */}
      {selected ? (
        <div className="stitch-card space-y-4 p-5">
          <h3 className="font-bold">{getMedicineDisplayName(selected)}</h3>
          <p className="text-xs text-on-surface-variant font-mono">ID: {selected.id}</p>

          {/* Edit medicine */}
          <EditMedicineForm token={token} medicine={selected} onDone={() => { load(query); }} />

          {/* Upload image */}
          <form className="flex gap-2" onSubmit={onUploadImage}>
            <input ref={fileRef} type="file" accept="image/*" className="stitch-input flex-1" required />
            <button type="submit" className="stitch-button">Загрузить</button>
          </form>

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
        </div>
      ) : null}
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

/* ── Clients Tab ── */

function ClientsTab({ token }: { token: string }) {
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
      <input className="stitch-input w-full" placeholder="Поиск клиентов..." value={query} onChange={(e) => onSearchChange(e.target.value)} />

      <div className="space-y-2">
        {clients.map((client) => (
          <div key={client.clientId} className="stitch-card flex items-center justify-between p-3">
            <div>
              <p className="font-bold">{client.name}</p>
              <p className="text-xs text-on-surface-variant">{client.phoneNumber} · <span className="font-mono">{client.clientId.slice(0, 8)}</span></p>
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

/* ── Orders + Payment Intents Tab ── */

function OrdersTab({ token }: { token: string }) {
  const [orders, setOrders] = useState<ApiOrder[]>([]);
  const [intents, setIntents] = useState<ApiPaymentIntent[]>([]);
  const [statusFilter, setStatusFilter] = useState("");
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    Promise.all([getAllOrders(token, statusFilter), getPendingPaymentIntents(token)])
      .then(([o, i]) => { setOrders(o); setIntents(i); })
      .catch((err) => setError(err instanceof Error ? err.message : "Ошибка."));
  }, [token, statusFilter]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="space-y-5">
      {error ? <div className="rounded-xl bg-red-100 p-3 text-sm text-red-700">{error}</div> : null}

      {/* Status filter */}
      <select className="stitch-input" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
        <option value="">Все статусы</option>
        {["New", "UnderReview", "Preparing", "Ready", "OnTheWay", "Delivered", "Cancelled", "Returned"].map((s) => (
          <option key={s} value={s}>{s}</option>
        ))}
      </select>

      {/* Payment intents */}
      {intents.length > 0 ? (
        <section>
          <h3 className="mb-2 text-sm font-bold uppercase tracking-wider text-on-surface-variant">Ожидающие подтверждения оплаты ({intents.length})</h3>
          <div className="space-y-2">
            {intents.map((intent) => (
              <PaymentIntentCard key={intent.paymentIntentId} token={token} intent={intent} onDone={load} />
            ))}
          </div>
        </section>
      ) : null}

      {/* Orders list */}
      <section>
        <h3 className="mb-2 text-sm font-bold uppercase tracking-wider text-on-surface-variant">Заказы ({orders.length})</h3>
        <div className="space-y-2">
          {orders.map((order) => (
            <div key={order.orderId} className="stitch-card space-y-2 p-3">
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs text-on-surface-variant">#{order.orderId.slice(0, 8)}</span>
                <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${order.status === "Delivered" ? "bg-emerald-100 text-emerald-800" : order.status === "Cancelled" ? "bg-red-100 text-red-700" : "bg-blue-100 text-blue-800"}`}>{order.status}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span>{order.pharmacyTitle ?? "—"}</span>
                <span className="font-bold">{formatMoney(order.cost, order.currency)}</span>
              </div>
              {order.status !== "Delivered" && order.status !== "Cancelled" ? (
                <button type="button" className="stitch-button text-xs" onClick={async () => {
                  await superAdminNextStatus(token, order.orderId).catch(() => undefined);
                  load();
                }}>Следующий статус</button>
              ) : null}
            </div>
          ))}
          {orders.length === 0 ? <div className="text-sm text-on-surface-variant">Нет заказов.</div> : null}
        </div>
      </section>
    </div>
  );
}

function PaymentIntentCard({ token, intent, onDone }: { token: string; intent: ApiPaymentIntent; onDone: () => void }) {
  const [showReject, setShowReject] = useState(false);
  const [reason, setReason] = useState("");

  return (
    <div className="stitch-card space-y-2 p-4">
      <div className="flex items-center justify-between">
        <span className="font-mono text-xs">{intent.paymentIntentId.slice(0, 8)}</span>
        <span className="font-bold">{formatMoney(intent.amount, intent.currency)}</span>
      </div>
      {intent.clientPhone ? <p className="text-xs text-on-surface-variant">Клиент: {intent.clientPhone}</p> : null}

      {!showReject ? (
        <div className="flex gap-2">
          <button type="button" className="stitch-button text-xs" onClick={async () => {
            await confirmPaymentIntent(token, intent.paymentIntentId).catch(() => undefined);
            onDone();
          }}>Подтвердить</button>
          <button type="button" className="rounded-lg bg-red-100 px-3 py-1 text-xs font-bold text-red-700" onClick={() => setShowReject(true)}>Отклонить</button>
        </div>
      ) : (
        <div className="space-y-2">
          <input className="stitch-input w-full" placeholder="Причина отклонения..." value={reason} onChange={(e) => setReason(e.target.value)} />
          <div className="flex gap-2">
            <button type="button" className="rounded-lg bg-red-600 px-3 py-1 text-xs font-bold text-white" onClick={async () => {
              await rejectPaymentIntent(token, intent.paymentIntentId).catch(() => undefined);
              onDone();
            }}>Отклонить</button>
            <button type="button" className="stitch-button-secondary text-xs" onClick={() => setShowReject(false)}>Отмена</button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Refunds Tab ── */

function RefundsTab({ token }: { token: string }) {
  const [refunds, setRefunds] = useState<ApiRefundRequest[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    getRefundRequests(token).then(setRefunds).catch((err) => setError(err instanceof Error ? err.message : "Ошибка."));
  }, [token]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="space-y-4">
      {error ? <div className="rounded-xl bg-red-100 p-3 text-sm text-red-700">{error}</div> : null}

      {refunds.length === 0 ? <div className="text-sm text-on-surface-variant">Нет запросов на возврат.</div> : null}

      {refunds.map((refund) => (
        <div key={refund.refundRequestId} className="stitch-card space-y-2 p-4">
          <div className="flex items-center justify-between">
            <span className="font-mono text-xs">#{refund.refundRequestId.slice(0, 8)}</span>
            <span className="font-bold">{formatMoney(refund.amount, refund.currency)}</span>
          </div>
          <p className="text-sm text-on-surface-variant">{refund.reason ?? "Без причины"}</p>
          <div className="flex items-center justify-between">
            <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${refund.status === "Completed" ? "bg-emerald-100 text-emerald-800" : "bg-yellow-100 text-yellow-800"}`}>{refund.status}</span>
            {refund.status !== "Completed" && refund.status !== "Failed" ? (
              <button type="button" className="stitch-button text-xs" onClick={async () => {
                await initiateRefund(token, refund.refundRequestId).catch(() => undefined);
                load();
              }}>Инициировать возврат</button>
            ) : null}
          </div>
        </div>
      ))}
    </div>
  );
}
