"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useDeliveryAddressStore, type SavedAddress } from "@/features/delivery/model/deliveryAddressStore";
import { useAppSelector } from "@/shared/lib/redux";
import { AddressAutocomplete } from "@/widgets/address/AddressAutocomplete";
import { getBrowserGeolocation, type GeoResult, type GeoPoint } from "@/shared/lib/map";
import type { PharmacyMapHandle } from "@/widgets/map/PharmacyMap";
import {
  getMyAddresses,
  upsertMyAddress,
  updateMyAddress,
  deleteMyAddress,
  type ClientAddress,
} from "@/entities/client/api";
import dynamic from "next/dynamic";

const PharmacyMap = dynamic(() => import("@/widgets/map/PharmacyMap").then((m) => m.PharmacyMap), { ssr: false });

type Props = {
  open: boolean;
  onClose: () => void;
  autoGeolocate?: boolean;
};

export function AddressPickerModal({ open, onClose, autoGeolocate }: Props) {
  const address = useDeliveryAddressStore((s) => s.address);
  const coords = useDeliveryAddressStore((s) => s.coords);
  const setAddressWithCoords = useDeliveryAddressStore((s) => s.setAddressWithCoords);
  const legacySaved = useDeliveryAddressStore((s) => s.savedAddresses);
  const loadLegacyHistory = useDeliveryAddressStore((s) => s.loadHistory);
  const saveLegacyHistory = useDeliveryAddressStore((s) => s.saveToHistory);
  const removeLegacyHistory = useDeliveryAddressStore((s) => s.removeFromHistory);

  const token = useAppSelector((s) => s.auth.token);
  const userId = useAppSelector((s) => s.auth.userId);

  const [localAddress, setLocalAddress] = useState(address);
  const [localCoords, setLocalCoords] = useState<GeoPoint | null>(coords);
  const [geoLoading, setGeoLoading] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);
  const autoGeoTriggered = useRef(false);
  const mapHandleRef = useRef<PharmacyMapHandle | null>(null);

  // Server-side saved addresses (authenticated users)
  const [remoteAddresses, setRemoteAddresses] = useState<ClientAddress[]>([]);
  const [namingForId, setNamingForId] = useState<string | null>(null);
  const [nameInput, setNameInput] = useState("");

  function panMapTo(point: GeoPoint) {
    mapHandleRef.current?.panTo(point);
  }

  const reloadRemote = useCallback(async () => {
    if (!token) return;
    try {
      const list = await getMyAddresses(token);
      setRemoteAddresses(list);
    } catch { /* ignore */ }
  }, [token]);

  useEffect(() => {
    if (open) {
      setLocalAddress(address);
      setLocalCoords(coords);
      setGeoError(null);
      if (token) {
        reloadRemote();
      } else if (userId) {
        loadLegacyHistory(userId);
      }
    } else {
      autoGeoTriggered.current = false;
      setNamingForId(null);
      setNameInput("");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, address, coords, userId, token]);

  useEffect(() => {
    if (open && autoGeolocate && !autoGeoTriggered.current && !address) {
      autoGeoTriggered.current = true;
      doGeolocation();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, autoGeolocate, address]);

  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
      return () => { document.body.style.overflow = ""; };
    }
  }, [open]);

  const handleMapDrag = useCallback(async (result: GeoResult) => {
    setLocalAddress(result.address);
    setLocalCoords({ lat: result.lat, lng: result.lng });
  }, []);

  async function handleConfirm() {
    setAddressWithCoords(localAddress, localCoords);
    if (token && localAddress.trim() && localCoords) {
      try {
        await upsertMyAddress(token, {
          address: localAddress.trim(),
          latitude: localCoords.lat,
          longitude: localCoords.lng,
        });
      } catch { /* history record is best-effort */ }
    } else if (userId && localAddress.trim()) {
      saveLegacyHistory(userId);
    }
    onClose();
  }

  function handleSelectRemote(a: ClientAddress) {
    setLocalAddress(a.address);
    setLocalCoords({ lat: a.latitude, lng: a.longitude });
    panMapTo({ lat: a.latitude, lng: a.longitude });
  }

  function handleSelectLegacy(saved: SavedAddress) {
    setLocalAddress(saved.address);
    setLocalCoords(saved.coords);
    if (saved.coords) panMapTo(saved.coords);
  }

  async function handleRemoveRemote(a: ClientAddress) {
    if (!token) return;
    try {
      await deleteMyAddress(token, a.id);
      setRemoteAddresses((prev) => prev.filter((x) => x.id !== a.id));
    } catch { /* ignore */ }
  }

  function startNaming(a: ClientAddress) {
    setNamingForId(a.id);
    setNameInput(a.title ?? "");
  }

  async function saveName(a: ClientAddress) {
    if (!token) return;
    const title = nameInput.trim();
    try {
      const updated = await updateMyAddress(token, a.id, {
        title: title || undefined,
        clearTitle: !title,
      });
      setRemoteAddresses((prev) => prev.map((x) => (x.id === a.id ? updated : x)));
      setNamingForId(null);
      setNameInput("");
    } catch (err) {
      alert(err instanceof Error ? err.message : "Не удалось сохранить имя");
    }
  }

  async function doGeolocation() {
    setGeoLoading(true);
    setGeoError(null);
    try {
      const point = await getBrowserGeolocation();
      const { getMapProvider } = await import("@/shared/lib/map");
      const result = await getMapProvider().reverseGeocode(point);
      if (result) {
        setLocalAddress(result.address);
        setLocalCoords({ lat: result.lat, lng: result.lng });
        panMapTo({ lat: result.lat, lng: result.lng });
      }
    } catch (err) {
      setGeoError(err instanceof Error ? err.message : "Не удалось определить местоположение");
    }
    setGeoLoading(false);
  }

  if (!open) return null;

  // Server-side: split named / history.
  // History excludes only named duplicates (by lowercased address). Currently
  // selected address stays visible so users can see what's active.
  const namedAddresses = remoteAddresses.filter((a) => a.title);
  const namedAddressTexts = new Set(namedAddresses.map((a) => a.address.trim().toLowerCase()));
  const historyAddresses = remoteAddresses
    .filter((a) => !a.title && !namedAddressTexts.has(a.address.trim().toLowerCase()))
    .slice(0, 3);

  // Guest fallback (localStorage)
  const legacyVisible = !token ? legacySaved.slice(0, 3) : [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto bg-surface rounded-2xl shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-surface-container-high">
          <h2 className="text-base sm:text-lg font-bold text-on-surface">Куда доставить заказ?</h2>
          <button
            type="button"
            onClick={onClose}
            className="flex items-center justify-center w-8 h-8 rounded-full hover:bg-surface-container-low transition"
            aria-label="Закрыть"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="p-4 sm:p-5 space-y-4">
          {/* Search row */}
          <div className="flex items-center gap-2">
            <div className="flex-1">
              <AddressAutocomplete
                value={localAddress}
                onChange={(addr) => { setLocalAddress(addr); }}
                onCoordinatesChange={(c) => { if (c) { setLocalCoords(c); panMapTo(c); } }}
                placeholder="Улица, дом, район..."
              />
            </div>
            {localAddress && (
              <button
                type="button"
                onClick={() => { setLocalAddress(""); setLocalCoords(null); }}
                className="flex items-center justify-center w-9 h-9 rounded-xl bg-surface-container-low text-on-surface-variant hover:bg-surface-container-high transition flex-shrink-0"
                aria-label="Очистить"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            )}
            <button
              type="button"
              onClick={handleConfirm}
              className="stitch-button px-5 py-2.5 text-sm flex-shrink-0"
            >
              Ок
            </button>
          </div>

          {/* Named addresses (server) */}
          {token && namedAddresses.length > 0 ? (
            <div className="space-y-1.5">
              <p className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider">Мои адреса</p>
              <div className="flex gap-1.5 overflow-x-auto scrollbar-hide scroll-touch pb-1 snap-x">
                {namedAddresses.map((a) => (
                  <div key={a.id} className="flex-shrink-0 snap-start">
                    <AddressChip
                      item={a}
                      isNamed
                      onSelect={() => handleSelectRemote(a)}
                      onRemove={() => handleRemoveRemote(a)}
                      onRename={() => startNaming(a)}
                      isRenaming={namingForId === a.id}
                      nameInput={nameInput}
                      onNameInputChange={setNameInput}
                      onSaveName={() => saveName(a)}
                      onCancelName={() => { setNamingForId(null); setNameInput(""); }}
                    />
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {/* History (server, without title) */}
          {token && historyAddresses.length > 0 ? (
            <div className="space-y-1.5">
              <p className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider">Недавние</p>
              <div className="flex gap-1.5 overflow-x-auto scrollbar-hide scroll-touch pb-1 snap-x">
                {historyAddresses.map((a) => (
                  <div key={a.id} className="flex-shrink-0 snap-start">
                    <AddressChip
                      item={a}
                      isNamed={false}
                      onSelect={() => handleSelectRemote(a)}
                      onRemove={() => handleRemoveRemote(a)}
                      onRename={() => startNaming(a)}
                      isRenaming={namingForId === a.id}
                      nameInput={nameInput}
                      onNameInputChange={setNameInput}
                      onSaveName={() => saveName(a)}
                      onCancelName={() => { setNamingForId(null); setNameInput(""); }}
                    />
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {/* Guest fallback — localStorage */}
          {!token && legacyVisible.length > 0 ? (
            <div className="space-y-1.5">
              <p className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider">Ранее использованные</p>
              <div className="flex gap-1.5 overflow-x-auto scrollbar-hide scroll-touch pb-1 snap-x">
                {legacyVisible.map((saved) => (
                  <div key={saved.address} className="flex-shrink-0 snap-start flex items-center gap-1 rounded-full bg-surface-container-low pl-3 pr-1 py-1 group">
                    <button
                      type="button"
                      onClick={() => handleSelectLegacy(saved)}
                      className="flex items-center gap-1.5 text-xs font-medium text-on-surface hover:text-primary transition truncate max-w-[200px]"
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0 text-on-surface-variant">
                        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" />
                      </svg>
                      {saved.address}
                    </button>
                    <button
                      type="button"
                      onClick={() => userId && removeLegacyHistory(userId, saved.address)}
                      className="flex items-center justify-center w-5 h-5 rounded-full text-on-surface-variant hover:text-red-500 hover:bg-red-50 transition opacity-0 group-hover:opacity-100"
                      aria-label="Удалить"
                    >
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
                        <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {/* Geolocation button + error */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={doGeolocation}
              disabled={geoLoading}
              className="flex items-center gap-1.5 text-xs font-semibold text-primary hover:text-primary/80 transition disabled:opacity-50"
            >
              {geoLoading ? (
                <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
              ) : (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="1" />
                  <line x1="12" y1="2" x2="12" y2="6" /><line x1="12" y1="18" x2="12" y2="22" />
                  <line x1="2" y1="12" x2="6" y2="12" /><line x1="18" y1="12" x2="22" y2="12" />
                </svg>
              )}
              Определить моё местоположение
            </button>
            {geoError ? <span className="text-xs text-red-500">{geoError}</span> : null}
          </div>

          <p className="text-xs text-on-surface-variant">
            Передвигайте карту для выбора точки доставки или введите адрес выше
          </p>

          <PharmacyMap
            className="h-[300px] sm:h-[400px] rounded-xl overflow-hidden"
            pharmacies={[]}
            selectedPoint={localCoords}
            centerPinMode
            onCenterChange={handleMapDrag}
            mapHandle={(h) => { mapHandleRef.current = h; }}
          />
        </div>
      </div>
    </div>
  );
}

type AddressChipProps = {
  item: ClientAddress;
  isNamed: boolean;
  onSelect: () => void;
  onRemove: () => void;
  onRename: () => void;
  isRenaming: boolean;
  nameInput: string;
  onNameInputChange: (v: string) => void;
  onSaveName: () => void;
  onCancelName: () => void;
};

function AddressChip({ item, isNamed, onSelect, onRemove, onRename, isRenaming, nameInput, onNameInputChange, onSaveName, onCancelName }: AddressChipProps) {
  if (isRenaming) {
    return (
      <div className="flex items-center gap-1 rounded-full bg-primary/5 border border-primary/30 pl-2 pr-1 py-1">
        <input
          type="text"
          value={nameInput}
          onChange={(e) => onNameInputChange(e.target.value.slice(0, 64))}
          placeholder="Дом, Работа..."
          className="w-28 bg-transparent text-xs outline-none placeholder:text-on-surface-variant"
          autoFocus
          onKeyDown={(e) => {
            if (e.key === "Enter") onSaveName();
            if (e.key === "Escape") onCancelName();
          }}
        />
        <button type="button" onClick={onSaveName} className="flex items-center justify-center w-5 h-5 rounded-full text-emerald-600 hover:bg-emerald-50 transition" aria-label="Сохранить">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
        </button>
        <button type="button" onClick={onCancelName} className="flex items-center justify-center w-5 h-5 rounded-full text-on-surface-variant hover:bg-surface-container-high transition" aria-label="Отмена">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
        </button>
      </div>
    );
  }

  return (
    <div className={`flex items-center gap-1 rounded-full pl-3 pr-1 py-1 group ${isNamed ? "bg-primary/10 border border-primary/30" : "bg-surface-container-low"}`}>
      <button
        type="button"
        onClick={onSelect}
        className="flex items-center gap-1.5 text-xs font-medium text-on-surface hover:text-primary transition max-w-[260px]"
        title={item.address}
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`flex-shrink-0 ${isNamed ? "text-primary" : "text-on-surface-variant"}`}>
          <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" />
        </svg>
        {isNamed ? (
          <span className="flex items-center gap-1.5 truncate">
            <span className="font-bold text-primary">{item.title}</span>
            <span className="text-[10px] text-on-surface-variant truncate">{item.address}</span>
          </span>
        ) : (
          <span className="truncate">{item.address}</span>
        )}
      </button>
      <button
        type="button"
        onClick={onRename}
        className="flex items-center justify-center w-5 h-5 rounded-full text-on-surface-variant hover:text-primary hover:bg-primary/10 transition opacity-0 group-hover:opacity-100"
        aria-label={isNamed ? "Переименовать" : "Дать имя"}
        title={isNamed ? "Переименовать" : "Дать имя"}
      >
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
      </button>
      <button
        type="button"
        onClick={onRemove}
        className="flex items-center justify-center w-5 h-5 rounded-full text-on-surface-variant hover:text-red-500 hover:bg-red-50 transition opacity-0 group-hover:opacity-100"
        aria-label="Удалить"
      >
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
          <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>
    </div>
  );
}
