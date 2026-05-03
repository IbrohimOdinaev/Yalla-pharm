"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { useAppSelector } from "@/shared/lib/redux";
import { formatMoney } from "@/shared/lib/format";
import { DatePicker, Select } from "@/shared/ui";
import { AppShell } from "@/widgets/layout/AppShell";
import { TopBar } from "@/widgets/layout/TopBar";

import { getAdmins, createAdmin, createAdminWithPharmacy, deleteAdmin, type ApiAdmin } from "@/entities/admin/api";
import { getAllPharmacies, updatePharmacy, deletePharmacy, uploadPharmacyIcon, deletePharmacyIcon } from "@/entities/pharmacy/admin-api";
import type { ActivePharmacy } from "@/entities/pharmacy/api";
import { getAllMedicines, createMedicine, updateMedicine, deleteMedicine, uploadMedicineImage } from "@/entities/medicine/admin-api";
import { getMedicineDisplayName, getMedicineById, resolveMedicineImageUrl } from "@/entities/medicine/api";
import { getCategories, flattenCategories } from "@/entities/category/api";
import type { ApiMedicine, ApiCategory, ApiOrder, ApiRefundRequest } from "@/shared/types/api";
import { getClients, deleteClient } from "@/entities/client/admin-api";
import type { ApiClient } from "@/shared/types/api";
import { getAllOrders, superAdminNextStatus, superAdminCancelOrder, superAdminReturnPositions } from "@/entities/order/admin-api";
import { computeOriginalPaid, computeRejectedRefund, computeReturnedRefund, computeNetCost, isOrderDataLost } from "@/entities/order/totals";
import { getPendingPaymentIntents, confirmPaymentIntent, rejectPaymentIntent, type ApiPaymentIntent } from "@/entities/payment/api";
import { getAwaitingConfirmation as getAwaitingPrescriptions, confirmPrescriptionPayment } from "@/entities/prescription/admin-api";
import { resolvePrescriptionImageUrl, PRESCRIPTION_STATUS_LABEL_RU, type ApiPrescription } from "@/entities/prescription/api";
import { getPharmacists, registerPharmacist, deletePharmacist, type ApiPharmacist } from "@/entities/pharmacist/api";
import { getRefundRequests, completeRefund } from "@/entities/refund/api";
import { getPaymentSettings, updateDcBaseUrl, type PaymentSettingsSnapshot } from "@/entities/payment-settings/api";
import { useOrderStatusLive } from "@/features/orders/model/useOrderStatusLive";
import { useSignalREvent } from "@/shared/lib/useSignalR";
import { DeliveryBadge, deliveryBorderClass } from "@/widgets/order/DeliveryBadge";
import type { GeoResult } from "@/shared/lib/map";
import dynamic from "next/dynamic";

const PharmacyMap = dynamic(() => import("@/widgets/map/PharmacyMap").then((m) => m.PharmacyMap), { ssr: false });

type Tab = "pharmacies" | "medicines" | "orders" | "prescriptions";

export default function SuperAdminPage() {
  const token = useAppSelector((state) => state.auth.token);
  const role = useAppSelector((state) => state.auth.role);
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<Tab>("pharmacies");

  // Auth gate — bounce unauthenticated/non-super visitors to the home page.
  // `replace` swaps the current entry so Back can't return them to /superadmin.
  // Triggers on logout (state goes null) and on direct hits by users without a session.
  useEffect(() => {
    if (!token || role !== "SuperAdmin") {
      router.replace("/");
    }
  }, [token, role, router]);

  // Sync activeTab from URL hash — poll because hashchange is unreliable with SPA
  useEffect(() => {
    function syncHash() {
      const h = window.location.hash.replace("#", "") as Tab;
      if (h === "medicines" || h === "orders" || h === "prescriptions") setActiveTab(h);
      else setActiveTab("pharmacies");
    }
    syncHash();
    window.addEventListener("hashchange", syncHash);
    const interval = setInterval(syncHash, 150);
    return () => { clearInterval(interval); window.removeEventListener("hashchange", syncHash); };
  }, []);

  // Render nothing while the auth-gate effect above performs the redirect —
  // avoids a flash of the "Access denied" stub on logout / direct hits.
  if (!token || role !== "SuperAdmin") {
    return null;
  }

  return (
    <AppShell top={<TopBar title="SuperAdmin" showLogout />} hideGlobalNav>
      <div className="space-y-4">
        {/* Hero */}
        <div className="rounded-2xl bg-gradient-to-br from-primary to-primary-container p-6 text-white space-y-2">
          <p className="text-[10px] font-bold uppercase tracking-widest opacity-60">SuperAdmin Control</p>
          <h1 className="text-2xl font-extrabold">Глобальное управление системой</h1>
          <p className="text-sm opacity-80">Управление аптеками, каталогом, клиентами и заказами.</p>
        </div>

        {/* Stats */}
        <StatsDashboard token={token} />

        {/* Payment BaseUrl settings */}
        <PaymentSettingsCard token={token} />

        {activeTab === "pharmacies" ? <PharmaciesTab token={token} /> : null}
        {activeTab === "medicines" ? <MedicinesTab token={token} /> : null}
        {activeTab === "orders" ? <OrdersTab token={token} /> : null}
        {activeTab === "prescriptions" ? <PrescriptionsTab token={token} /> : null}
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
      getAllMedicines(token, "", 1, 1).then((r) => r.totalCount),
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
    <div className="grid grid-cols-2 gap-1 xs:gap-2 sm:gap-3 md:grid-cols-4">
      {items.map((item) => (
        <div key={item.label} className="stitch-card p-1.5 xs:p-2 sm:p-4 text-center">
          <p className="text-base xs:text-lg sm:text-2xl font-black text-primary">{item.value}</p>
          <p className="text-[8px] xs:text-[10px] sm:text-sm font-bold uppercase tracking-wider text-on-surface-variant">{item.label}</p>
        </div>
      ))}
    </div>
  );
}

/* ── Payment Base URL card ── */

function PaymentSettingsCard({ token }: { token: string }) {
  const [snapshot, setSnapshot] = useState<PaymentSettingsSnapshot | null>(null);
  const [input, setInput] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(() => {
    getPaymentSettings(token).then((s) => {
      setSnapshot(s);
      setInput(s.dcBaseUrl ?? "");
    }).catch(() => undefined);
  }, [token]);

  useEffect(() => { load(); }, [load]);

  async function save() {
    const trimmed = input.trim();
    const confirmMsg = trimmed
      ? `Сменить base URL Dushanbe City Payment на:\n${trimmed}?\n\nВсе новые платежи будут использовать этот адрес.`
      : "Сбросить base URL к системному значению по умолчанию?";
    if (!confirm(confirmMsg)) return;
    setIsSaving(true);
    setMsg(null);
    try {
      const updated = await updateDcBaseUrl(token, trimmed || null);
      setSnapshot(updated);
      setInput(updated.dcBaseUrl ?? "");
      setIsEditing(false);
      setMsg("Base URL обновлён.");
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Ошибка сохранения.");
    } finally {
      setIsSaving(false);
    }
  }

  if (!snapshot) {
    return (
      <div className="stitch-card p-3 text-xs text-on-surface-variant">Загружаем настройки платежей...</div>
    );
  }

  const usingDefault = !snapshot.dcBaseUrl;

  return (
    <div className="stitch-card p-3 xs:p-4 sm:p-5 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 className="text-sm xs:text-base sm:text-lg font-bold">Платежи: Dushanbe City</h2>
          <p className="text-[10px] xs:text-xs text-on-surface-variant">
            Base URL применяется для всех новых платежей. Изменение не затрагивает уже созданные заказы.
          </p>
        </div>
        {!isEditing ? (
          <button type="button" className="stitch-button-secondary text-xs px-3 py-1.5 flex-shrink-0" onClick={() => setIsEditing(true)}>Изменить</button>
        ) : null}
      </div>

      {isEditing ? (
        <div className="space-y-2">
          <label className="block space-y-1">
            <span className="text-[10px] xs:text-xs font-semibold text-on-surface-variant uppercase">Base URL (пусто = по умолчанию)</span>
            <input
              type="url"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="http://pay.expresspay.tj/?A=..."
              className="stitch-input font-mono text-xs"
            />
          </label>
          {msg ? <p className={`text-[11px] ${msg.includes("обновлён") ? "text-emerald-600" : "text-red-600"}`}>{msg}</p> : null}
          <div className="flex gap-2">
            <button type="button" className="stitch-button-secondary text-xs flex-1 py-2" onClick={() => { setIsEditing(false); setInput(snapshot.dcBaseUrl ?? ""); setMsg(null); }}>Отмена</button>
            <button type="button" className="stitch-button text-xs flex-1 py-2" onClick={save} disabled={isSaving}>
              {isSaving ? "Сохраняем..." : "Сохранить"}
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${usingDefault ? "bg-surface-container-high text-on-surface-variant" : "bg-emerald-100 text-emerald-700"}`}>
              {usingDefault ? "По умолчанию" : "Переопределён"}
            </span>
            <p className="text-[10px] text-on-surface-variant">
              Обновлён: {new Date(snapshot.updatedAtUtc).toLocaleString("ru-RU")}
            </p>
          </div>
          <p className="font-mono text-[11px] xs:text-xs break-all bg-surface-container-low rounded-lg p-2">
            {snapshot.dcBaseUrlEffective}
          </p>
          {msg ? <p className="text-[11px] text-emerald-600">{msg}</p> : null}
        </div>
      )}
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
  const [showCreateMap, setShowCreateMap] = useState(false);
  const [newPharmaLat, setNewPharmaLat] = useState("");
  const [newPharmaLng, setNewPharmaLng] = useState("");

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
      setNewPharmaLat(""); setNewPharmaLng(""); setShowCreateMap(false);
      load(query);
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Ошибка.");
    }
  }

  return (
    <div className="space-y-2 xs:space-y-3 sm:space-y-4">
      <div>
        <h2 className="text-sm xs:text-base sm:text-lg font-bold">Управление аптеками и администраторами</h2>
        <p className="mt-1 text-[10px] xs:text-xs sm:text-sm text-on-surface-variant">Структурированный обзор, создание и изменение сущностей</p>
      </div>

      <input className="stitch-input w-full" placeholder="Поиск по аптекам и админам..." value={query} onChange={(e) => onSearchChange(e.target.value)} />

      {/* Create form */}
      <form className="stitch-card space-y-2 xs:space-y-3 sm:space-y-4 p-3 xs:p-4 sm:p-5" onSubmit={onCreateAdminPharmacy}>
        <div>
          <h3 className="text-sm xs:text-base sm:text-lg font-bold">Создать админа + аптеку</h3>
          <p className="mt-0.5 text-[10px] xs:text-xs sm:text-sm text-on-surface-variant">Новый администратор с новой аптекой</p>
        </div>
        <div className="grid gap-2 md:grid-cols-2">
          <input className="stitch-input" placeholder="Имя админа" value={newAdminName} onChange={(e) => setNewAdminName(e.target.value)} required />
          <input className="stitch-input" placeholder="Телефон" value={newAdminPhone} onChange={(e) => setNewAdminPhone(e.target.value)} required />
          <input className="stitch-input" type="password" placeholder="Пароль" value={newAdminPass} onChange={(e) => setNewAdminPass(e.target.value)} required />
          <input className="stitch-input" placeholder="Название аптеки" value={newPharmaTitle} onChange={(e) => setNewPharmaTitle(e.target.value)} required />
          <input className="stitch-input md:col-span-2" placeholder="Адрес аптеки" value={newPharmaAddr} onChange={(e) => setNewPharmaAddr(e.target.value)} required />
        </div>
        <button type="button" className="stitch-button-secondary text-xs w-full" onClick={() => setShowCreateMap(!showCreateMap)}>
          {showCreateMap ? "Скрыть карту" : "Выбрать адрес на карте"}
        </button>
        {showCreateMap && (
          <div className="space-y-1">
            <PharmacyMap
              className="h-[220px] xs:h-[260px] rounded-xl overflow-hidden"
              pharmacies={newPharmaLat && newPharmaLng ? [{ id: "new", title: newPharmaTitle || "Новая аптека", address: newPharmaAddr, lat: parseFloat(newPharmaLat), lng: parseFloat(newPharmaLng) }] : []}
              pickMode
              onMapClick={(result: GeoResult) => {
                setNewPharmaLat(result.lat.toFixed(6));
                setNewPharmaLng(result.lng.toFixed(6));
                if (result.address) setNewPharmaAddr(result.address);
              }}
            />
            {newPharmaLat && newPharmaLng && (
              <p className="text-[10px] text-on-surface-variant">Координаты: {newPharmaLat}, {newPharmaLng}</p>
            )}
          </div>
        )}
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
            <EditablePharmacyCard key={p.id} token={token} pharmacy={p} admins={admins} onDone={() => load(query)} />
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
    <form className="stitch-card space-y-2 xs:space-y-3 sm:space-y-4 p-3 xs:p-4 sm:p-5" onSubmit={onSubmit}>
      <div>
        <h3 className="text-sm xs:text-base sm:text-lg font-bold">Создать админа в существующую аптеку</h3>
        <p className="mt-0.5 text-[10px] xs:text-xs sm:text-sm text-on-surface-variant">Привязать нового админа к существующей аптеке</p>
      </div>
      <div className="grid gap-2 md:grid-cols-2">
        <input className="stitch-input" placeholder="Имя" value={name} onChange={(e) => setName(e.target.value)} required />
        <input className="stitch-input" placeholder="Телефон" value={phone} onChange={(e) => setPhone(e.target.value)} required />
        <input className="stitch-input" type="password" placeholder="Пароль" value={password} onChange={(e) => setPassword(e.target.value)} required />
        <Select
          value={pharmacyId}
          onChange={setPharmacyId}
          options={[
            { value: "", label: "Без аптеки" },
            ...pharmacies.map((p) => ({ value: p.id, label: p.title })),
          ]}
        />
      </div>
      {msg ? <div className={`text-sm ${msg.includes("создан") ? "text-emerald-700" : "text-red-700"}`}>{msg}</div> : null}
      <button type="submit" className="stitch-button">Создать</button>
    </form>
  );
}

function EditablePharmacyCard({ token, pharmacy, admins, onDone }: { token: string; pharmacy: ActivePharmacy; admins: ApiAdmin[]; onDone: () => void }) {
  const [isEditing, setIsEditing] = useState(false);
  const [title, setTitle] = useState(pharmacy.title);
  const [address, setAddress] = useState(pharmacy.address);
  const [isActive, setIsActive] = useState(pharmacy.isActive ?? true);
  const [lat, setLat] = useState(pharmacy.latitude?.toString() ?? "");
  const [lng, setLng] = useState(pharmacy.longitude?.toString() ?? "");
  const [showMapPicker, setShowMapPicker] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [iconUploading, setIconUploading] = useState(false);
  const iconFileRef = useRef<HTMLInputElement>(null);

  // Find current admin for this pharmacy
  const pharmacyAdmin = admins.find((a) => a.pharmacyId === pharmacy.id);

  const iconSrc = pharmacy.iconUrl
    ? (pharmacy.iconUrl.startsWith("http") ? pharmacy.iconUrl : `/api/pharmacies/icon/${pharmacy.id}/content`)
    : null;

  async function onSave(e: FormEvent) {
    e.preventDefault();
    setMsg(null);
    try {
      await updatePharmacy(token, {
        pharmacyId: pharmacy.id, title, address, isActive,
        latitude: lat ? parseFloat(lat) : undefined,
        longitude: lng ? parseFloat(lng) : undefined,
      });
      setMsg("Обновлено.");
      setIsEditing(false);
      onDone();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Ошибка.");
    }
  }

  async function onIconUpload() {
    const file = iconFileRef.current?.files?.[0];
    if (!file) return;
    setIconUploading(true);
    setMsg(null);
    try {
      await uploadPharmacyIcon(token, pharmacy.id, file);
      setMsg("Иконка загружена.");
      onDone();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Ошибка загрузки.");
    } finally {
      setIconUploading(false);
      if (iconFileRef.current) iconFileRef.current.value = "";
    }
  }

  async function onIconDelete() {
    if (!confirm("Удалить иконку аптеки?")) return;
    try {
      await deletePharmacyIcon(token, pharmacy.id);
      onDone();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Ошибка.");
    }
  }

  async function onRemoveAdmin() {
    if (!pharmacyAdmin) return;
    if (!confirm(`Удалить админа ${pharmacyAdmin.name} из аптеки?`)) return;
    try {
      await deleteAdmin(token, pharmacyAdmin.adminId);
      onDone();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Ошибка.");
    }
  }

  if (isEditing) {
    return (
      <form className="stitch-card space-y-2 xs:space-y-3 sm:space-y-4 p-3 xs:p-4 sm:p-5" onSubmit={onSave}>
        <input className="stitch-input" placeholder="Название" value={title} onChange={(e) => setTitle(e.target.value)} required />
        <input className="stitch-input" placeholder="Адрес" value={address} onChange={(e) => setAddress(e.target.value)} required />
        <div className="grid grid-cols-2 gap-2">
          <input className="stitch-input" placeholder="Широта (lat)" type="number" step="any" value={lat} onChange={(e) => setLat(e.target.value)} />
          <input className="stitch-input" placeholder="Долгота (lng)" type="number" step="any" value={lng} onChange={(e) => setLng(e.target.value)} />
        </div>
        <button type="button" className="stitch-button-secondary text-xs w-full" onClick={() => setShowMapPicker(!showMapPicker)}>
          {showMapPicker ? "Скрыть карту" : "Выбрать на карте"}
        </button>
        {showMapPicker && (
          <PharmacyMap
            className="h-[250px]"
            pharmacies={lat && lng ? [{ id: pharmacy.id, title, address, lat: parseFloat(lat), lng: parseFloat(lng) }] : []}
            selectedPoint={lat && lng ? { lat: parseFloat(lat), lng: parseFloat(lng) } : null}
            pickMode
            onMapClick={(result: GeoResult) => {
              setLat(result.lat.toFixed(6));
              setLng(result.lng.toFixed(6));
              if (result.address && !result.address.match(/^\d/)) setAddress(result.address);
            }}
          />
        )}

        {/* Icon upload */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-on-surface-variant">Иконка аптеки</label>
          <div className="flex gap-2 items-center">
            {iconSrc ? (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={iconSrc} alt="Иконка" className="h-10 w-10 rounded-lg object-cover border border-surface-container-high flex-shrink-0" />
                <button type="button" onClick={onIconDelete} className="text-xs text-red-600 font-semibold">Удалить</button>
              </>
            ) : (
              <span className="text-xs text-on-surface-variant">Не загружена</span>
            )}
          </div>
          <div className="flex gap-2 items-center">
            <input ref={iconFileRef} type="file" accept="image/png,image/jpeg,image/webp" className="text-xs flex-1" onChange={onIconUpload} />
            {iconUploading && <span className="text-xs text-primary">Загрузка...</span>}
          </div>
        </div>

        {/* Admin section */}
        <div className="space-y-1.5 rounded-xl bg-surface-container-low p-2.5 xs:p-3">
          <label className="text-xs font-semibold text-on-surface-variant">Администратор</label>
          {pharmacyAdmin ? (
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-bold">{pharmacyAdmin.name}</p>
                <p className="text-[10px] text-on-surface-variant">{pharmacyAdmin.phoneNumber}</p>
              </div>
              <button type="button" onClick={onRemoveAdmin} className="rounded-lg bg-red-100 px-2 py-1 text-[10px] font-bold text-red-700">
                Удалить админа
              </button>
            </div>
          ) : (
            <p className="text-xs text-yellow-600">Нет администратора. Создайте нового в форме ниже.</p>
          )}
        </div>

        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} /> Активна
        </label>
        {msg ? <div className={`text-xs ${msg.includes("Обновлено") || msg.includes("загружена") ? "text-emerald-700" : "text-red-700"}`}>{msg}</div> : null}
        <div className="flex gap-2">
          <button type="submit" className="stitch-button text-xs">Сохранить</button>
          <button type="button" className="stitch-button-secondary text-xs" onClick={() => setIsEditing(false)}>Отмена</button>
        </div>
      </form>
    );
  }

  return (
    <div className="stitch-card flex items-center justify-between gap-3 p-3">
      <div className="flex items-start gap-2.5 flex-1 min-w-0">
        {iconSrc ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={iconSrc} alt="" className="h-10 w-10 rounded-lg object-cover border border-surface-container-high flex-shrink-0" />
        ) : (
          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-primary" strokeLinecap="round"><path d="M3 21h18"/><path d="M5 21V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16"/></svg>
          </div>
        )}
        <div className="min-w-0">
          <p className="font-bold truncate">{pharmacy.title}</p>
          <p className="text-xs text-on-surface-variant truncate">{pharmacy.address} · {pharmacy.isActive ? "Активна" : "Неактивна"}</p>
          {pharmacyAdmin && <p className="text-[10px] text-on-surface-variant">Админ: {pharmacyAdmin.name}</p>}
          {!pharmacyAdmin && <p className="text-[10px] text-yellow-600">Нет админа</p>}
          {pharmacy.latitude && pharmacy.longitude ? (
            <p className="text-[10px] text-on-surface-variant">Координаты: {pharmacy.latitude}, {pharmacy.longitude}</p>
          ) : (
            <p className="text-[10px] text-yellow-600">Координаты не заданы</p>
          )}
        </div>
      </div>
      <div className="flex gap-1 flex-shrink-0">
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

type ActiveFilter = "all" | "active" | "inactive";

function MedicinesTab({ token }: { token: string }) {
  const [medicines, setMedicines] = useState<ApiMedicine[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<ActiveFilter>("all");
  const [categoryId, setCategoryId] = useState<string>("");
  const [categories, setCategories] = useState<ApiCategory[]>([]);
  const [flatCats, setFlatCats] = useState<ApiCategory[]>([]);
  const [selected, setSelected] = useState<ApiMedicine | null>(null);
  const [selectedDetails, setSelectedDetails] = useState<ApiMedicine | null>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pageSize = 50;

  useEffect(() => {
    getCategories().then((cats) => {
      setCategories(cats);
      setFlatCats(flattenCategories(cats));
    }).catch(() => undefined);
  }, []);

  const load = useCallback((q = "", p = 1, filter: ActiveFilter = "all", catId = "") => {
    const isActive = filter === "active" ? true : filter === "inactive" ? false : undefined;
    getAllMedicines(token, q, p, pageSize, isActive, catId || undefined).then((r) => {
      setMedicines(r.medicines);
      setTotalCount(r.totalCount);
    }).catch(() => undefined);
  }, [token]);

  useEffect(() => { load(query, page, activeFilter, categoryId); }, [load, page, activeFilter, categoryId]);

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

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
    debounceRef.current = setTimeout(() => { setPage(1); load(v, 1, activeFilter, categoryId); }, 300);
  }

  function onFilterChange(f: ActiveFilter) {
    setActiveFilter(f);
    setPage(1);
  }

  function onCategoryChange(catId: string) {
    setCategoryId(catId);
    setPage(1);
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
        const [type, value] = pair.split(":").map((s) => s.trim());
        return { type: type || "", value: value || "" };
      }).filter((a) => a.type);
      await createMedicine(token, { title: newTitle, articul: newArticul || undefined, atributes: atributes.length > 0 ? atributes : undefined });
      setMsg("Товар создан.");
      setNewTitle(""); setNewArticul(""); setNewAttrs("");
      load(query, page, activeFilter, categoryId);
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
      load(query, page, activeFilter, categoryId);
      // Re-fetch details to show new image
      getMedicineById(selected.id).then(setSelectedDetails).catch(() => undefined);
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Ошибка загрузки.");
    }
  }

  const detail = selectedDetails ?? selected;
  const imageUrl = detail ? resolveMedicineImageUrl(detail) : "";

  return (
    <div className="relative">
      {/* Medicine list */}
      <div className="space-y-5">
        <div>
          <h2 className="text-sm xs:text-base sm:text-lg font-bold">Управление каталогом товаров</h2>
          <p className="mt-1 text-[10px] xs:text-xs sm:text-sm text-on-surface-variant">Создание, поиск, редактирование и управление изображениями.</p>
        </div>

        {/* Create */}
        <form className="stitch-card space-y-2 xs:space-y-3 sm:space-y-4 p-3 xs:p-4 sm:p-5" onSubmit={onCreateMedicine}>
          <h3 className="text-sm xs:text-base sm:text-lg font-bold">Создать товар</h3>
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

        {/* Category filter */}
        <Select
          value={categoryId}
          onChange={onCategoryChange}
          options={[
            { value: "", label: "Все категории" },
            ...flatCats.map((cat) => ({
              value: cat.id,
              label: cat.name,
              depth: cat.parentId ? 1 : 0,
            })),
          ]}
        />

        {/* Active filter */}
        <div className="flex flex-wrap gap-2">
          {([
            { id: "all" as ActiveFilter, label: "Все" },
            { id: "active" as ActiveFilter, label: "Активные" },
            { id: "inactive" as ActiveFilter, label: "Неактивные" },
          ]).map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => onFilterChange(f.id)}
              className={`rounded-full px-3 py-1.5 text-xs font-bold transition ${
                activeFilter === f.id ? "bg-primary text-white" : "bg-surface-container-low text-on-surface-variant"
              }`}
            >
              {f.label}
            </button>
          ))}
          <span className="ml-auto text-xs text-on-surface-variant self-center">{medicines.length} из {totalCount}</span>
        </div>

        {/* List */}
        <div className="grid grid-cols-2 gap-2 xs:gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {medicines.map((m) => (
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
                    <img src={resolveMedicineImageUrl(m)} alt="" className="h-full w-full object-contain mix-blend-multiply" />
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

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="rounded-lg px-3 py-1.5 text-xs font-bold bg-surface-container-low text-on-surface-variant disabled:opacity-30"
            >
              &larr;
            </button>
            {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
              let p: number;
              if (totalPages <= 7) { p = i + 1; }
              else if (page <= 4) { p = i + 1; }
              else if (page >= totalPages - 3) { p = totalPages - 6 + i; }
              else { p = page - 3 + i; }
              return (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPage(p)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                    page === p ? "bg-primary text-white" : "bg-surface-container-low text-on-surface-variant"
                  }`}
                >
                  {p}
                </button>
              );
            })}
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="rounded-lg px-3 py-1.5 text-xs font-bold bg-surface-container-low text-on-surface-variant disabled:opacity-30"
            >
              &rarr;
            </button>
          </div>
        )}
      </div>

      {/* Detail overlay */}
      {selected && detail ? (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-12 xs:pt-16 sm:pt-20">
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/40" onClick={() => setSelected(null)} />
          {/* Panel */}
          <div className="relative mx-2 xs:mx-4 w-full max-w-2xl max-h-[85vh] overflow-y-auto rounded-2xl bg-surface shadow-glass space-y-2 xs:space-y-3 sm:space-y-4 p-3 xs:p-4 sm:p-5">
            {/* Close */}
            <button type="button" onClick={() => setSelected(null)} className="absolute top-2 right-2 xs:top-3 xs:right-3 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-surface-container-low text-on-surface-variant hover:bg-surface-container-high transition" aria-label="Закрыть">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>

            {detailsLoading ? (
              <div className="text-sm text-on-surface-variant">Загрузка...</div>
            ) : (
              <>
                {/* Image preview */}
                {imageUrl ? (
                  <div className="overflow-hidden rounded-xl bg-surface-container">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={imageUrl} alt={getMedicineDisplayName(detail)} className="mx-auto max-h-48 xs:max-h-56 sm:max-h-64 object-contain mix-blend-multiply" />
                  </div>
                ) : (
                  <div className="flex h-32 xs:h-36 sm:h-40 items-center justify-center rounded-xl bg-surface-container-low text-sm text-on-surface-variant">
                    Нет изображения
                  </div>
                )}

                {/* Title, articul, status, ID */}
                <div className="space-y-1">
                  <h3 className="text-sm xs:text-base sm:text-lg font-bold pr-8">{getMedicineDisplayName(detail)}</h3>
                  {detail.articul ? <p className="text-xs xs:text-sm text-on-surface-variant">Артикул: {detail.articul}</p> : null}
                  {detail.categoryName ? <p className="text-xs xs:text-sm text-on-surface-variant">Категория: <span className="font-medium text-on-surface">{detail.categoryName}</span></p> : null}
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
                    <h4 className="mb-2 text-xs xs:text-sm font-bold uppercase tracking-wider text-on-surface-variant">Атрибуты</h4>
                    <div className="flex flex-wrap gap-1.5 xs:gap-2">
                      {detail.atributes.map((attr, i) => (
                        <span key={i} className="rounded-full bg-surface-container-low px-2 xs:px-3 py-0.5 xs:py-1 text-[10px] xs:text-xs font-medium">
                          {attr.type || attr.name}: {attr.value || attr.option}
                        </span>
                      ))}
                    </div>
                  </div>
                ) : null}

                {/* Pharmacy offers */}
                {detail.offers && detail.offers.length > 0 ? (
                  <div>
                    <h4 className="mb-2 text-xs xs:text-sm font-bold uppercase tracking-wider text-on-surface-variant">Предложения аптек ({detail.offers.length})</h4>
                    <div className="space-y-1.5 xs:space-y-2">
                      {detail.offers.map((offer, i) => (
                        <div key={i} className="flex items-center justify-between rounded-xl bg-surface-container-low p-2 xs:p-3 text-xs xs:text-sm">
                          <span className="font-medium truncate mr-2">{offer.pharmacyTitle ?? offer.pharmacyId.slice(0, 8)}</span>
                          <div className="flex items-center gap-2 xs:gap-3 text-[10px] xs:text-xs flex-shrink-0">
                            <span className="text-on-surface-variant">Ост: {offer.stockQuantity}</span>
                            <span className="font-bold">{formatMoney(offer.price)}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}

                {/* Edit medicine */}
                <div>
                  <h4 className="mb-2 text-xs xs:text-sm font-bold uppercase tracking-wider text-on-surface-variant">Редактирование</h4>
                  <EditMedicineForm token={token} medicine={detail} onDone={() => {
                    load(query, page, activeFilter, categoryId);
                    getMedicineById(detail.id).then(setSelectedDetails).catch(() => undefined);
                  }} />
                </div>

                {/* Upload image */}
                <div>
                  <h4 className="mb-2 text-xs xs:text-sm font-bold uppercase tracking-wider text-on-surface-variant">Загрузка изображения</h4>
                  <form className="space-y-2 xs:space-y-3" onSubmit={onUploadImage}>
                    <div className="flex flex-wrap gap-3 xs:gap-4">
                      <label className="flex items-center gap-1.5 xs:gap-2 text-xs xs:text-sm">
                        <input type="checkbox" checked={uploadIsMain} onChange={e => setUploadIsMain(e.target.checked)} />
                        Основное фото
                      </label>
                      <label className="flex items-center gap-1.5 xs:gap-2 text-xs xs:text-sm">
                        <input type="checkbox" checked={uploadIsMinimal} onChange={e => setUploadIsMinimal(e.target.checked)} />
                        Миниатюра
                      </label>
                    </div>
                    <div className="flex gap-2">
                      <input ref={fileRef} type="file" accept="image/*" className="stitch-input flex-1 text-xs" required />
                      <button type="submit" className="stitch-button text-xs xs:text-sm">Загрузить</button>
                    </div>
                  </form>
                </div>

                {/* Actions */}
                <div className="flex flex-wrap gap-2">
                  <button type="button" className="rounded-xl bg-yellow-100 px-3 xs:px-4 py-1.5 xs:py-2 text-xs xs:text-sm font-bold text-yellow-800" onClick={async () => {
                    await deleteMedicine(token, selected.id, false).catch(() => undefined);
                    setSelected(null); load(query, page, activeFilter, categoryId);
                  }}>Деактивировать</button>
                  <button type="button" className="rounded-xl bg-red-100 px-3 xs:px-4 py-1.5 xs:py-2 text-xs xs:text-sm font-bold text-red-700" onClick={async () => {
                    if (!confirm("Удалить товар полностью?")) return;
                    await deleteMedicine(token, selected.id, true).catch(() => undefined);
                    setSelected(null); load(query, page, activeFilter, categoryId);
                  }}>Удалить полностью</button>
                </div>
              </>
            )}
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
    <div className="space-y-2 xs:space-y-3 sm:space-y-4">
      <div>
        <h2 className="text-sm xs:text-base sm:text-lg font-bold">Клиентский реестр</h2>
        <p className="mt-1 text-[10px] xs:text-xs sm:text-sm text-on-surface-variant">Просмотр клиентов и управление аккаунтами. История заказов сохраняется при удалении.</p>
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

function OrdersTab({ token }: { token: string }) {
  const [orders, setOrders] = useState<ApiOrder[]>([]);
  const [intents, setIntents] = useState<ApiPaymentIntent[]>([]);
  const [refunds, setRefunds] = useState<ApiRefundRequest[]>([]);
  const [pharmacyTitleById, setPharmacyTitleById] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [dateFilter, setDateFilter] = useState("");
  const [selectedOrder, setSelectedOrder] = useState<ApiOrder | null>(null);
  const [returnMode, setReturnMode] = useState(false);
  const [returnQty, setReturnQty] = useState<Record<string, number>>({});

  // Pharmacy title lookup — backend returns only `pharmacyId` on orders, so
  // we resolve the readable title client-side. Loaded once per token.
  useEffect(() => {
    getAllPharmacies(token)
      .then((list) => {
        const map: Record<string, string> = {};
        for (const p of list) map[p.id] = p.title;
        setPharmacyTitleById(map);
      })
      .catch(() => undefined);
  }, [token]);

  const load = useCallback(() => {
    Promise.all([getAllOrders(token, ""), getPendingPaymentIntents(token), getRefundRequests(token)])
      .then(([o, i, r]) => { setOrders(o); setIntents(i); setRefunds(r); })
      .catch((err) => setError(err instanceof Error ? err.message : "Ошибка."));
  }, [token]);

  useOrderStatusLive(useCallback(() => { load(); }, [load]));

  // Also reload when payment intents change (confirm/reject)
  useSignalREvent("PaymentIntentUpdated", useCallback(() => { load(); }, [load]), token);

  useEffect(() => { load(); }, [load]);

  // Reset return-mode whenever a different order is opened or overlay closes.
  useEffect(() => {
    setReturnMode(false);
    setReturnQty({});
  }, [selectedOrder?.orderId]);

  // Whenever the orders list refetches, swap the open overlay's reference to
  // the freshly loaded one so it shows the latest status / positions / totals.
  useEffect(() => {
    if (!selectedOrder) return;
    const fresh = orders.find(o => o.orderId === selectedOrder.orderId);
    if (fresh && fresh !== selectedOrder) setSelectedOrder(fresh);
  }, [orders, selectedOrder]);

  // Restore the open-order overlay from ?orderId= when navigating back from
  // /product or after a hard reload. Fires whenever orders list changes (on
  // initial load and on refetches), but never re-opens what the user just
  // closed — closeOverlay() strips the param from the URL synchronously.
  useEffect(() => {
    if (typeof window === "undefined" || orders.length === 0) return;
    if (selectedOrder) return;
    const url = new URL(window.location.href);
    const wantId = url.searchParams.get("orderId");
    if (!wantId) return;
    const found = orders.find(o => o.orderId === wantId);
    if (found) setSelectedOrder(found);
  }, [orders, selectedOrder]);

  function openOverlay(order: ApiOrder) {
    setSelectedOrder(order);
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    url.searchParams.set("orderId", order.orderId);
    window.history.replaceState({}, "", url.toString());
  }

  function closeOverlay() {
    setSelectedOrder(null);
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    url.searchParams.delete("orderId");
    window.history.replaceState({}, "", url.toString());
  }


  const filteredOrders = dateFilter
    ? orders.filter((o) => o.createdAtUtc && new Date(o.createdAtUtc).toISOString().slice(0, 10) === dateFilter)
    : orders;

  // Order IDs that have pending payment intents — avoid showing them as regular order cards
  const intentOrderIds = new Set(intents.map((i) => i.reservedOrderId).filter(Boolean));

  const grouped = ALL_STATUSES.reduce<Record<string, ApiOrder[]>>((acc, status) => {
    acc[status] = filteredOrders.filter((o) => {
      if (o.status !== status) return false;
      // In "New" column, hide orders that already appear as payment intent cards
      if (status === "New" && intentOrderIds.has(o.orderId)) return false;
      return true;
    });
    return acc;
  }, {});

  return (
    <div className="space-y-2 xs:space-y-3 sm:space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-sm xs:text-base sm:text-lg font-bold">Управление заказами</h2>
          <p className="mt-1 text-[10px] xs:text-xs sm:text-sm text-on-surface-variant">Контроль статусов и подтверждение оплат{dateFilter ? ` · ${dateFilter}` : ""}</p>
        </div>
        <div className="flex items-center gap-2">
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

      {/* Kanban columns */}
      <section>
        <h3 className="mb-3 text-sm font-bold uppercase tracking-wider text-on-surface-variant">Заказы ({filteredOrders.length})</h3>
        <div className="flex gap-4 overflow-x-auto pb-4">
          {ALL_STATUSES.map(status => {
            const statusOrders = grouped[status];
            // Show payment intents in the New column
            const showIntentsHere = status === "New";
            return (
              <div key={status} className="min-w-[220px] xs:min-w-[250px] sm:min-w-[280px] flex-shrink-0 rounded-2xl bg-surface-container-low p-3 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={`w-2.5 h-2.5 rounded-full ${STATUS_COLORS[status]}`} />
                    <h4 className="text-[10px] xs:text-xs sm:text-sm font-bold">{STATUS_LABELS[status]}</h4>
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
                    const tgHandle = order.clientTelegramUsername
                      ? `@${order.clientTelegramUsername.replace(/^@/, "")}`
                      : order.clientTelegramId
                        ? `tg:${order.clientTelegramId}`
                        : "";
                    return (
                      <div key={order.orderId} className={`stitch-card p-3 cursor-pointer hover:ring-1 hover:ring-primary transition ${deliveryBorderClass(!!order.isPickup)}`} onClick={() => openOverlay(order)}>
                        <div className="flex items-center justify-between gap-1">
                          <span className="text-[10px] text-on-surface-variant font-mono">#{order.orderId.slice(0, 8)}</span>
                          <DeliveryBadge isPickup={!!order.isPickup} iconOnly />
                        </div>
                        <div className="flex items-center justify-between text-sm mt-1 gap-2">
                          {order.pharmacyTitle ? (
                            <span className="truncate max-w-[140px]">{order.pharmacyTitle}</span>
                          ) : <span />}
                          {computeOriginalPaid(order) > 0 ? (
                            <span className="font-bold">{formatMoney(computeOriginalPaid(order), order.currency)}</span>
                          ) : null}
                        </div>
                        {order.clientName ? (
                          <p className="mt-0.5 text-[11px] font-semibold truncate">{order.clientName}</p>
                        ) : null}
                        <div className="flex items-center justify-between mt-0.5 gap-1">
                          {order.createdAtUtc ? <p className="text-[10px] text-on-surface-variant">{new Date(order.createdAtUtc).toLocaleDateString("ru-RU")}</p> : <span/>}
                          {phone ? <span className="text-[10px] font-mono text-on-surface-variant">{phone}</span> : null}
                        </div>
                        {tgHandle ? (
                          <p className="text-[10px] font-mono text-tertiary truncate">{tgHandle}</p>
                        ) : null}
                        {isOrderDataLost(order) ? (
                          <div className="mt-1 flex items-center gap-1 rounded-md bg-amber-100 border border-amber-300 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800">
                            <span aria-hidden>⚠</span>
                            <span>Данные утеряны</span>
                          </div>
                        ) : null}
                        {order.status === "OnTheWay" ? (
                          <button
                            type="button"
                            className="mt-2 w-full rounded-lg bg-emerald-600 px-3 py-1.5 text-[10px] xs:text-xs font-bold text-white hover:bg-emerald-700 transition"
                            onClick={async (e) => {
                              e.stopPropagation();
                              await superAdminNextStatus(token, order.orderId).catch(() => undefined);
                              load();
                            }}
                          >
                            Доставлен
                          </button>
                        ) : null}
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

          {/* Refund kanban columns — sit at the end of the horizontal scroll
              alongside order-status columns so the SuperAdmin can shepherd
              refund workflows in the same workspace as order workflows. */}
          <RefundKanbanColumn
            title="Возвраты средств"
            dotClassName="bg-amber-500"
            refunds={refunds.filter((r) => r.status !== "Completed")}
            token={token}
            onChange={load}
            showCompleteAction
          />
          <RefundKanbanColumn
            title="Возвращённые средства"
            dotClassName="bg-emerald-500"
            refunds={refunds.filter((r) => r.status === "Completed")}
            token={token}
            onChange={load}
          />
        </div>
      </section>

      {/* Order detail overlay */}
      {selectedOrder ? (
        <div className="fixed inset-0 z-50 bg-on-surface/50 flex items-start justify-center p-4 pt-16 overflow-y-auto" onClick={closeOverlay}>
          <div className="stitch-card w-full max-w-2xl p-6 space-y-5" onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-mono text-on-surface-variant">#{selectedOrder.orderId.slice(0, 8)}</p>
                <h2 className="text-xl font-extrabold">Заказ</h2>
              </div>
              <button type="button" onClick={closeOverlay} className="rounded-xl bg-surface-container-low p-2 hover:bg-surface-container-high">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>

            {isOrderDataLost(selectedOrder) ? (
              <div className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
                <p className="font-bold">⚠ Данные позиций утеряны</p>
                <p className="mt-0.5 text-xs text-amber-800">
                  Этот заказ — исторический: записи позиций отсутствуют в БД.
                  Сумма и состав показаны как 0 — данные восстановить нельзя.
                </p>
              </div>
            ) : null}

            {/* Order info grid */}
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 sm:gap-3 text-sm">
              <div className="rounded-xl bg-surface-container-low p-3">
                <p className="text-[10px] text-on-surface-variant uppercase">Статус</p>
                <p className="font-bold">{STATUS_LABELS[selectedOrder.status] ?? selectedOrder.status}</p>
              </div>
              <div className="rounded-xl bg-surface-container-low p-3">
                <p className="text-[10px] text-on-surface-variant uppercase">Сумма заказа</p>
                <p className="font-bold text-primary">{formatMoney(computeOriginalPaid(selectedOrder), selectedOrder.currency)}</p>
              </div>
              <div className="rounded-xl bg-surface-container-low p-3">
                <p className="text-[10px] text-on-surface-variant uppercase">Доставка</p>
                <p className="font-bold">{selectedOrder.isPickup ? "Самовывоз" : selectedOrder.deliveryAddress || "—"}</p>
              </div>
              <div className="rounded-xl bg-surface-container-low p-3">
                <p className="text-[10px] text-on-surface-variant uppercase">Дата</p>
                <p className="font-bold">{selectedOrder.createdAtUtc ? new Date(selectedOrder.createdAtUtc).toLocaleString("ru-RU") : "—"}</p>
              </div>
              {selectedOrder.clientPhoneNumber || selectedOrder.clientName || selectedOrder.clientTelegramUsername || selectedOrder.clientTelegramId ? (
                <div className="rounded-xl bg-surface-container-low p-3 space-y-0.5">
                  <p className="text-[10px] text-on-surface-variant uppercase">Клиент</p>
                  {selectedOrder.clientName ? <p className="font-bold">{selectedOrder.clientName}</p> : null}
                  {selectedOrder.clientPhoneNumber ? <p className="font-mono text-sm">{selectedOrder.clientPhoneNumber}</p> : null}
                  {selectedOrder.clientTelegramUsername ? (
                    <p className="font-mono text-xs text-tertiary">@{selectedOrder.clientTelegramUsername.replace(/^@/, "")}</p>
                  ) : selectedOrder.clientTelegramId ? (
                    <p className="font-mono text-xs text-tertiary">tg:{selectedOrder.clientTelegramId}</p>
                  ) : null}
                </div>
              ) : null}
              {selectedOrder.pharmacyTitle || selectedOrder.pharmacyId ? (
                <div className="rounded-xl bg-surface-container-low p-3">
                  <p className="text-[10px] text-on-surface-variant uppercase">Аптека</p>
                  <p className="font-bold">
                    {selectedOrder.pharmacyTitle
                      || (selectedOrder.pharmacyId ? pharmacyTitleById[selectedOrder.pharmacyId] : null)
                      || selectedOrder.pharmacyId?.slice(0, 8)
                      || "—"}
                  </p>
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
              {(() => {
                const rejected = computeRejectedRefund(selectedOrder);
                const returned = computeReturnedRefund(selectedOrder);
                const net = computeNetCost(selectedOrder);
                const hasAnyRefund = rejected > 0 || returned > 0;
                return (
                  <>
                    {hasAnyRefund ? (
                      <div className="rounded-xl bg-surface-container-low p-3">
                        <p className="text-[10px] text-on-surface-variant uppercase">За полученные</p>
                        <p className="font-bold">{formatMoney(net, selectedOrder.currency)}</p>
                      </div>
                    ) : null}
                    {rejected > 0 ? (
                      <div className="rounded-xl bg-red-50 border border-red-100 p-3">
                        <p className="text-[10px] text-red-600 uppercase">Возврат за отклонённые</p>
                        <p className="font-bold text-red-700">{formatMoney(rejected, selectedOrder.currency)}</p>
                      </div>
                    ) : null}
                    {returned > 0 ? (
                      <div className="rounded-xl bg-red-50 border border-red-100 p-3">
                        <p className="text-[10px] text-red-600 uppercase">Возврат за возвращённые</p>
                        <p className="font-bold text-red-700">{formatMoney(returned, selectedOrder.currency)}</p>
                      </div>
                    ) : null}
                  </>
                );
              })()}
            </div>

            {/* Comment */}
            {selectedOrder.comment ? (
              <div className="rounded-xl bg-amber-50 border border-amber-200 p-3 space-y-1">
                <p className="text-[10px] text-amber-700 uppercase tracking-wider font-semibold">Комментарий клиента</p>
                <p className="text-sm text-amber-900 whitespace-pre-wrap">{selectedOrder.comment}</p>
              </div>
            ) : null}

            {/* Positions as mini-cards */}
            {(selectedOrder.positions ?? []).length > 0 ? (
              <div className="space-y-2">
                <h3 className="text-sm font-bold uppercase tracking-wider text-on-surface-variant">Позиции ({selectedOrder.positions!.length})</h3>
                {selectedOrder.positions!.map(pos => (
                  <Link
                    key={pos.positionId}
                    href={pos.medicineId ? `/product/${pos.medicineId}` : "#"}
                    className="flex items-center gap-3 rounded-xl bg-surface-container-low p-3 transition hover:bg-surface-container-high"
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
                const label = selectedOrder.status === "New" ? "подтвердить оплату и передать заказ аптеке" : "подтвердить доставку заказа клиенту";
                if (!confirm(`Действительно ${label} #${selectedOrder.orderId.slice(0, 8)}?`)) return;
                await superAdminNextStatus(token, selectedOrder.orderId).catch(() => undefined);
                load();
                closeOverlay();
              }}>{selectedOrder.status === "New" ? "Подтвердить и передать аптеке" : "Подтвердить доставку"}</button>
            ) : null}

            {/* Cancel — SuperAdmin can cancel from any pre-delivery status */}
            {selectedOrder.status && !["Delivered", "PickedUp", "Returned", "Cancelled"].includes(selectedOrder.status) ? (
              <button
                type="button"
                className="w-full rounded-xl bg-red-100 px-4 py-3 text-sm font-bold text-red-700 hover:bg-red-200 transition"
                onClick={async () => {
                  if (!confirm(`Отменить заказ #${selectedOrder.orderId.slice(0, 8)}?`)) return;
                  try {
                    await superAdminCancelOrder(token, selectedOrder.orderId);
                    load();
                    closeOverlay();
                  } catch (err) {
                    alert(err instanceof Error ? err.message : "Не удалось отменить заказ");
                  }
                }}
              >
                Отменить заказ
              </button>
            ) : null}

            {/* Return flow — only for completed orders (Delivered/PickedUp or already Returned) */}
            {selectedOrder.status && ["Delivered", "PickedUp", "Returned"].includes(selectedOrder.status) ? (
              !returnMode ? (
                <button
                  type="button"
                  className="w-full rounded-xl border border-red-200 bg-white px-4 py-3 text-sm font-bold text-red-700 hover:bg-red-50 transition"
                  onClick={() => {
                    setReturnMode(true);
                    const initial: Record<string, number> = {};
                    for (const p of selectedOrder.positions ?? []) {
                      if (!p.isRejected) initial[p.positionId] = p.returnedQuantity ?? 0;
                    }
                    setReturnQty(initial);
                  }}
                >
                  {selectedOrder.status === "Returned" ? "Добавить ещё возвраты" : "Оформить возврат позиций"}
                </button>
              ) : (
                <div className="rounded-xl border border-red-200 bg-red-50/50 p-3 space-y-3">
                  <div>
                    <p className="text-sm font-bold text-red-900">Возврат позиций</p>
                    <p className="text-[11px] text-red-700">Укажите сколько единиц клиент вернул по каждой позиции. 0 — не возвращал.</p>
                  </div>
                  <div className="space-y-2">
                    {(selectedOrder.positions ?? []).filter(p => !p.isRejected).map((pos) => {
                      const current = returnQty[pos.positionId] ?? 0;
                      return (
                        <div key={pos.positionId} className="flex items-center gap-2 bg-white rounded-lg p-2 border border-red-100">
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-semibold truncate">{pos.medicine?.title ?? pos.medicineId.slice(0, 8)}</p>
                            <p className="text-[10px] text-on-surface-variant">Заказано: {pos.quantity} · Цена: {formatMoney(pos.price)}</p>
                          </div>
                          <div className="flex items-center gap-1 flex-shrink-0">
                            <button type="button" className="w-6 h-6 rounded bg-surface-container-low text-sm font-bold" onClick={() => setReturnQty(q => ({ ...q, [pos.positionId]: Math.max(0, (q[pos.positionId] ?? 0) - 1) }))}>−</button>
                            <input
                              type="number"
                              min={0}
                              max={pos.quantity}
                              value={current}
                              onChange={(e) => {
                                const v = Math.max(0, Math.min(pos.quantity, Number(e.target.value) || 0));
                                setReturnQty(q => ({ ...q, [pos.positionId]: v }));
                              }}
                              className="w-12 text-center rounded bg-surface-container-low py-0.5 text-sm font-mono"
                            />
                            <span className="text-[10px] text-on-surface-variant">/{pos.quantity}</span>
                            <button type="button" className="w-6 h-6 rounded bg-surface-container-low text-sm font-bold" onClick={() => setReturnQty(q => ({ ...q, [pos.positionId]: Math.min(pos.quantity, (q[pos.positionId] ?? 0) + 1) }))}>+</button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  {(() => {
                    const totalRefund = (selectedOrder.positions ?? [])
                      .filter(p => !p.isRejected)
                      .reduce((sum, p) => sum + (p.price ?? 0) * (returnQty[p.positionId] ?? 0), 0);
                    const hasAny = Object.values(returnQty).some(v => v > 0);
                    return (
                      <div className="flex items-center justify-between gap-2 pt-2 border-t border-red-200">
                        <div>
                          <p className="text-[10px] text-red-700 uppercase font-semibold">К возврату</p>
                          <p className="text-sm font-bold text-red-900">{formatMoney(totalRefund, selectedOrder.currency)}</p>
                        </div>
                        <div className="flex gap-2">
                          <button type="button" className="rounded-lg px-3 py-2 text-xs font-bold bg-white border border-red-200 text-red-700" onClick={() => { setReturnMode(false); setReturnQty({}); }}>
                            Отмена
                          </button>
                          <button
                            type="button"
                            disabled={!hasAny}
                            className="rounded-lg px-3 py-2 text-xs font-bold bg-red-600 text-white disabled:opacity-50"
                            onClick={async () => {
                              const positions = Object.entries(returnQty)
                                .filter(([, q]) => q > 0)
                                .map(([positionId, quantity]) => ({ positionId, quantity }));
                              if (positions.length === 0) return;
                              try {
                                await superAdminReturnPositions(token, selectedOrder.orderId, positions);
                                setReturnMode(false);
                                setReturnQty({});
                                load();
                                closeOverlay();
                              } catch (err) {
                                alert(err instanceof Error ? err.message : "Не удалось оформить возврат");
                              }
                            }}
                          >
                            Подтвердить возврат
                          </button>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

/**
 * Refund kanban column — sits at the end of the order kanban horizontal scroll
 * to keep refund triage in the same operational workspace as order triage.
 *
 * Two columns are rendered on the page:
 *  - Active refunds (status != Completed): each card has a "Подтвердить возврат
 *    средств" action that flips status → Completed and moves the card to the
 *    completed column on the next data reload.
 *  - Completed refunds: read-only ledger.
 *
 * Card layout matches the order card (same width, same compact info density)
 * so the SuperAdmin can scan all columns with a single eye-track.
 */
function RefundKanbanColumn({
  title,
  dotClassName,
  refunds,
  token,
  onChange,
  showCompleteAction,
}: {
  title: string;
  dotClassName: string;
  refunds: ApiRefundRequest[];
  token: string;
  onChange: () => void;
  showCompleteAction?: boolean;
}) {
  return (
    <div className="min-w-[220px] xs:min-w-[250px] sm:min-w-[280px] flex-shrink-0 rounded-2xl bg-surface-container-low p-3 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className={`w-2.5 h-2.5 rounded-full ${dotClassName}`} />
          <h4 className="text-[10px] xs:text-xs sm:text-sm font-bold">{title}</h4>
        </div>
        <span className="rounded-full bg-surface-container-high px-2 py-0.5 text-[10px] font-bold">
          {refunds.length}
        </span>
      </div>
      <div className="space-y-2 max-h-[60vh] overflow-y-auto">
        {refunds.length === 0 ? (
          <p className="text-xs text-on-surface-variant text-center py-4">Пусто</p>
        ) : (
          refunds.map((refund) => (
            <RefundKanbanCard
              key={refund.refundRequestId}
              refund={refund}
              token={token}
              onChange={onChange}
              showCompleteAction={!!showCompleteAction}
            />
          ))
        )}
      </div>
    </div>
  );
}

function RefundKanbanCard({
  refund,
  token,
  onChange,
  showCompleteAction,
}: {
  refund: ApiRefundRequest;
  token: string;
  onChange: () => void;
  showCompleteAction: boolean;
}) {
  const [busy, setBusy] = useState(false);

  const isProductReturn = refund.type === 1;
  const positions = refund.positions ?? [];
  const positionsCount = positions.reduce((sum, p) => sum + (p.quantity ?? 0), 0);

  // Completion is allowed from any non-terminal state (Created or InitiatedBySuperAdmin).
  // Rejected is terminal-and-not-refundable; Completed is already done. Both hide the button.
  const canComplete = showCompleteAction
    && refund.status !== "Completed"
    && refund.status !== "Rejected";

  // Border accent mirrors the type indicator (amber = with product return, emerald = without).
  const borderClass = isProductReturn ? "border-l-4 border-amber-400" : "border-l-4 border-emerald-400";

  return (
    <div className={`stitch-card p-3 ${borderClass}`}>
      <div className="flex items-center justify-between gap-1">
        <span className="text-[10px] text-on-surface-variant font-mono">
          #{refund.refundRequestId.slice(0, 8)}
        </span>
        <span
          className={`rounded-full px-1.5 py-0.5 text-[9px] font-extrabold uppercase ${
            isProductReturn ? "bg-amber-100 text-amber-800" : "bg-emerald-100 text-emerald-800"
          }`}
          title={isProductReturn ? "С возвратом товара" : "Без возврата товара"}
        >
          {isProductReturn ? "товар" : "ден."}
        </span>
      </div>
      <div className="flex items-center justify-between text-sm mt-1 gap-2">
        {refund.pharmacyTitle ? (
          <span className="truncate max-w-[140px]">{refund.pharmacyTitle}</span>
        ) : <span />}
        <span className="font-bold tabular-nums">{formatMoney(refund.amount, refund.currency)}</span>
      </div>
      {refund.clientName ? (
        <p className="mt-0.5 text-[11px] font-semibold truncate">{refund.clientName}</p>
      ) : null}
      <div className="flex items-center justify-between mt-0.5 gap-1">
        {refund.createdAtUtc ? (
          <p className="text-[10px] text-on-surface-variant">
            {new Date(refund.createdAtUtc).toLocaleDateString("ru-RU")}
          </p>
        ) : <span />}
        <span className="text-[10px] text-on-surface-variant">
          {positions.length}поз · {positionsCount}ед
        </span>
      </div>
      {/* Order context — order id + status chip. Helps connect the refund back to the
          order that triggered it without opening anything. */}
      {refund.orderId ? (
        <p className="text-[10px] text-on-surface-variant/80 truncate">
          Заказ #{refund.orderId.slice(0, 8)}{refund.orderStatus ? ` · ${refund.orderStatus}` : ""}
        </p>
      ) : null}
      {refund.status === "Completed" && refund.updatedAtUtc ? (
        <p className="text-[10px] text-emerald-700 font-semibold">
          Возвращён {new Date(refund.updatedAtUtc).toLocaleDateString("ru-RU")}
        </p>
      ) : null}

      {/* Confirm refund — flips status → Completed and the card jumps to the
          "Возвращённые средства" column on the next reload. */}
      {canComplete ? (
        <button
          type="button"
          disabled={busy}
          onClick={async () => {
            if (!confirm(`Подтвердить возврат ${formatMoney(refund.amount, refund.currency)} клиенту?`)) return;
            setBusy(true);
            try {
              await completeRefund(token, refund.refundRequestId);
              onChange();
            } finally {
              setBusy(false);
            }
          }}
          className="mt-2 w-full rounded-lg bg-emerald-600 px-3 py-1.5 text-[10px] xs:text-xs font-bold text-white hover:bg-emerald-700 transition disabled:opacity-50"
        >
          {busy ? "..." : "Подтвердить возврат"}
        </button>
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
    <div className="stitch-card space-y-2 p-2 xs:p-3 sm:p-4 ring-1 ring-yellow-300">
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
            if (!confirm(`Подтвердить оплату для заказа #${intent.reservedOrderId?.slice(0, 8) ?? intent.paymentIntentId.slice(0, 8)}? Заказ будет передан аптеке.`)) return;
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
              if (!confirm("Отклонить этот платёж? Заказ будет отменён.")) return;
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


/* ── Prescriptions Tab ──────────────────────────────────────────────── */

function PrescriptionsTab({ token }: { token: string }) {
  return (
    <div className="space-y-6">
      <PendingPrescriptionsSection token={token} />
      <PharmacistsSection token={token} />
    </div>
  );
}

function PendingPrescriptionsSection({ token }: { token: string }) {
  const [items, setItems] = useState<ApiPrescription[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    return getAwaitingPrescriptions(token)
      .then(setItems)
      .catch((err) => setError(err instanceof Error ? err.message : "Ошибка загрузки"))
      .finally(() => setLoading(false));
  }, [token]);

  useEffect(() => { load(); }, [load]);

  async function onConfirm(id: string) {
    if (!confirm("Подтвердить оплату 3 TJS? Заявка уйдёт в очередь к фармацевтам.")) return;
    setBusyId(id);
    try {
      await confirmPrescriptionPayment(token, id);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось подтвердить");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-display text-lg font-extrabold">Запросы на расшифровку рецептов</h2>
        <button type="button" onClick={load} className="stitch-button-secondary text-xs">Обновить</button>
      </div>

      {error ? (
        <div className="rounded-2xl bg-secondary/10 p-3 text-sm font-semibold text-secondary">{error}</div>
      ) : null}

      {loading ? (
        <div className="rounded-2xl bg-surface-container-low p-6 text-sm text-on-surface-variant">Загружаем…</div>
      ) : items.length === 0 ? (
        <div className="rounded-2xl bg-surface-container-low p-6 text-sm text-on-surface-variant">
          Нет заявок, ждущих подтверждения оплаты.
        </div>
      ) : (
        <ul className="space-y-2">
          {items.map((p) => {
            const created = new Date(p.createdAtUtc).toLocaleString("ru-RU");
            return (
              <li key={p.prescriptionId} className="rounded-2xl bg-surface-container-lowest p-4 shadow-card">
                <div className="flex items-start gap-3">
                  <div className="flex flex-shrink-0 gap-2">
                    {p.images.slice(0, 2).map((img) => (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        key={img.id}
                        src={resolvePrescriptionImageUrl(img.url)}
                        alt=""
                        className="h-20 w-16 rounded-lg object-cover bg-surface-container"
                      />
                    ))}
                  </div>
                  <div className="min-w-0 flex-1 space-y-1">
                    <p className="text-sm">
                      <span className="font-semibold text-on-surface-variant">Возраст: </span>
                      <span className="font-bold">{p.patientAge}</span>
                    </p>
                    {p.clientComment ? (
                      <p className="text-xs text-on-surface-variant">
                        <span className="font-semibold">Коммент: </span>
                        {p.clientComment}
                      </p>
                    ) : null}
                    <p className="text-[11px] text-on-surface-variant">{created}</p>
                    <p className="text-[11px] font-mono text-on-surface-variant/70">{p.prescriptionId}</p>
                  </div>
                  <button
                    type="button"
                    disabled={busyId === p.prescriptionId}
                    onClick={() => onConfirm(p.prescriptionId)}
                    className="rounded-full bg-primary px-4 py-2 text-xs font-bold text-white transition hover:bg-primary-container disabled:opacity-50"
                  >
                    {busyId === p.prescriptionId ? "..." : "Подтвердить оплату"}
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function PharmacistsSection({ token }: { token: string }) {
  const [items, setItems] = useState<ApiPharmacist[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    return getPharmacists(token)
      .then(setItems)
      .catch((err) => setError(err instanceof Error ? err.message : "Ошибка загрузки"))
      .finally(() => setLoading(false));
  }, [token]);

  useEffect(() => { load(); }, [load]);

  async function onDelete(id: string) {
    if (!confirm("Удалить фармацевта? Действие не отменить.")) return;
    try {
      await deletePharmacist(token, id);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось удалить");
    }
  }

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-display text-lg font-extrabold">Фармацевты</h2>
        <button type="button" onClick={() => setShowForm((s) => !s)} className="stitch-button-secondary text-xs">
          {showForm ? "Отмена" : "Добавить фармацевта"}
        </button>
      </div>

      {error ? (
        <div className="rounded-2xl bg-secondary/10 p-3 text-sm font-semibold text-secondary">{error}</div>
      ) : null}

      {showForm ? (
        <RegisterPharmacistForm
          token={token}
          onDone={async () => { setShowForm(false); await load(); }}
        />
      ) : null}

      {loading ? (
        <div className="rounded-2xl bg-surface-container-low p-6 text-sm text-on-surface-variant">Загружаем…</div>
      ) : items.length === 0 ? (
        <div className="rounded-2xl bg-surface-container-low p-6 text-sm text-on-surface-variant">
          Пока нет фармацевтов. Добавьте первого, чтобы они смогли расшифровывать рецепты.
        </div>
      ) : (
        <ul className="space-y-2">
          {items.map((ph) => (
            <li key={ph.id} className="flex items-center gap-3 rounded-2xl bg-surface-container-lowest p-3 shadow-card">
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary font-bold">
                {ph.name.slice(0, 1).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold">{ph.name}</p>
                <p className="text-xs text-on-surface-variant">+{ph.phoneNumber}</p>
              </div>
              <button
                type="button"
                onClick={() => onDelete(ph.id)}
                className="rounded-full px-3 py-1.5 text-xs font-bold text-secondary transition hover:bg-secondary-soft"
              >
                Удалить
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function RegisterPharmacistForm({
  token,
  onDone,
}: {
  token: string;
  onDone: () => void | Promise<void>;
}) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setErr(null);
    setSubmitting(true);
    try {
      await registerPharmacist(token, { name: name.trim(), phoneNumber: phone.trim(), password });
      setName(""); setPhone(""); setPassword("");
      await onDone();
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : "Ошибка регистрации");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3 rounded-2xl bg-surface-container-low p-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <input
          className="stitch-input"
          placeholder="Имя"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
        <input
          className="stitch-input"
          placeholder="Телефон (9 цифр)"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          required
        />
        <input
          className="stitch-input"
          type="password"
          placeholder="Пароль (8+ символов)"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
      </div>
      {err ? <p className="text-xs font-semibold text-secondary">{err}</p> : null}
      <button
        type="submit"
        disabled={submitting}
        className="rounded-full bg-primary px-5 py-2 text-sm font-bold text-white transition hover:bg-primary-container disabled:opacity-50"
      >
        {submitting ? "..." : "Зарегистрировать"}
      </button>
    </form>
  );
}
