"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useDeliveryAddressStore, type SavedAddress } from "@/features/delivery/model/deliveryAddressStore";
import { useAppSelector } from "@/shared/lib/redux";
import { AddressAutocomplete } from "@/widgets/address/AddressAutocomplete";
import { SavedAddressEditorModal } from "@/widgets/address/SavedAddressEditorModal";
import { getBrowserGeolocation, type GeoResult, type GeoPoint } from "@/shared/lib/map";
import type { PharmacyMapHandle } from "@/widgets/map/PharmacyMap";
import {
  getMyAddresses,
  upsertMyAddress,
  updateMyAddress,
  deleteMyAddress,
  type ClientAddress,
} from "@/entities/client/api";
import { Button } from "@/shared/ui";
import dynamic from "next/dynamic";

const PharmacyMap = dynamic(() => import("@/widgets/map/PharmacyMap").then((m) => m.PharmacyMap), { ssr: false });

type Props = {
  open: boolean;
  onClose: () => void;
  autoGeolocate?: boolean;
};

type View = "list" | "map";

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
  const [editorOpen, setEditorOpen] = useState(false);

  // View routing: data-driven by default (list if any saved/recent, otherwise map),
  // but user can force into "map" via the explicit button and back to "list".
  const [forcedView, setForcedView] = useState<View | null>(null);

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
      setForcedView(null);
      setEditorOpen(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, address, coords, userId, token]);

  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
      return () => { document.body.style.overflow = ""; };
    }
  }, [open]);

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

  // Authenticated users always start in list view (their saved/recent + "+ Добавить адрес" CTA),
  // even when both lists are empty. Guests skip the list when there's no legacy history.
  const hasGuestHistory = legacyVisible.length > 0;
  const defaultView: View = token ? "list" : hasGuestHistory ? "list" : "map";
  const view: View = forcedView ?? defaultView;
  const hasAny = token || hasGuestHistory;

  // Auto-geolocate when no saved data and caller asked for it.
  useEffect(() => {
    if (open && view === "map" && autoGeolocate && !autoGeoTriggered.current && !address) {
      autoGeoTriggered.current = true;
      doGeolocation();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, view, autoGeolocate, address]);

  const handleMapDrag = useCallback((result: GeoResult) => {
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

  function pickRemote(a: ClientAddress) {
    // Forward the user-defined title so the topbar pill can render it instead
    // of the raw street address. Free-form picks don't pass a title, which
    // clears any previously-set label.
    setAddressWithCoords(a.address, { lat: a.latitude, lng: a.longitude }, a.title ?? null);
    // Bump LastUsed server-side so it surfaces first next time. Best-effort.
    if (token) {
      upsertMyAddress(token, {
        address: a.address,
        title: a.title ?? undefined,
        latitude: a.latitude,
        longitude: a.longitude,
      }).catch(() => undefined);
    }
    onClose();
  }

  function pickLegacy(saved: SavedAddress) {
    if (!saved.coords) {
      // No coordinates → can't compute delivery cost. Switch to map so user can refine.
      setLocalAddress(saved.address);
      setForcedView("map");
      return;
    }
    setAddressWithCoords(saved.address, saved.coords, null);
    if (userId) saveLegacyHistory(userId);
    onClose();
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
        // List view has no map → switch to map so user sees the point.
        setForcedView("map");
        // Pan once map is mounted (next tick).
        setTimeout(() => panMapTo({ lat: result.lat, lng: result.lng }), 50);
      }
    } catch (err) {
      setGeoError(err instanceof Error ? err.message : "Не удалось определить местоположение");
    }
    setGeoLoading(false);
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto bg-surface rounded-2xl shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-surface-container-high">
          <div className="flex items-center gap-2 min-w-0">
            {view === "map" && hasAny ? (
              <button
                type="button"
                onClick={() => setForcedView("list")}
                className="flex items-center justify-center w-8 h-8 rounded-full hover:bg-surface-container-low transition flex-shrink-0"
                aria-label="Назад к списку"
                title="Назад"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="15 18 9 12 15 6" />
                </svg>
              </button>
            ) : null}
            <h2 className="text-base sm:text-lg font-bold text-on-surface truncate">Куда доставить заказ?</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex items-center justify-center w-8 h-8 rounded-full hover:bg-surface-container-low transition flex-shrink-0"
            aria-label="Закрыть"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="p-4 sm:p-5 space-y-4">
          {view === "list" ? (
            <>
              {/* Pick on map — primary entry to map view */}
              <Button size="md" fullWidth leftIcon="pin" onClick={() => setForcedView("map")}>
                Выбрать адрес на карте
              </Button>

              {/* Named addresses (server) */}
              {token ? (
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider">Мои адреса</p>
                  {namedAddresses.length > 0 ? (
                    <ul className="space-y-1.5">
                      {namedAddresses.map((a) => (
                        <li key={a.id}>
                          <AddressRow
                            item={a}
                            isNamed
                            onSelect={() => pickRemote(a)}
                            onRemove={() => handleRemoveRemote(a)}
                            onRename={() => startNaming(a)}
                            isRenaming={namingForId === a.id}
                            nameInput={nameInput}
                            onNameInputChange={setNameInput}
                            onSaveName={() => saveName(a)}
                            onCancelName={() => { setNamingForId(null); setNameInput(""); }}
                          />
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-xs text-on-surface-variant/70 italic px-1">
                      Пока пусто — нажмите «Добавить адрес» ниже или сохраните в профиле
                    </p>
                  )}
                  {/* Add saved address — opens editor modal */}
                  <button
                    type="button"
                    onClick={() => setEditorOpen(true)}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:text-primary/80 transition"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                    </svg>
                    Добавить адрес
                  </button>
                </div>
              ) : null}

              {/* History (server, without title) */}
              {token ? (
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider">Недавние</p>
                  {historyAddresses.length > 0 ? (
                    <ul className="space-y-1.5">
                      {historyAddresses.map((a) => (
                        <li key={a.id}>
                          <AddressRow
                            item={a}
                            isNamed={false}
                            onSelect={() => pickRemote(a)}
                            onRemove={() => handleRemoveRemote(a)}
                            onRename={() => startNaming(a)}
                            isRenaming={namingForId === a.id}
                            nameInput={nameInput}
                            onNameInputChange={setNameInput}
                            onSaveName={() => saveName(a)}
                            onCancelName={() => { setNamingForId(null); setNameInput(""); }}
                          />
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-xs text-on-surface-variant/70 italic px-1">
                      Адреса из ваших последних заказов появятся здесь
                    </p>
                  )}
                </div>
              ) : null}

              {/* Guest fallback — localStorage */}
              {!token && legacyVisible.length > 0 ? (
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider">Ранее использованные</p>
                  <ul className="space-y-1.5">
                    {legacyVisible.map((saved) => (
                      <li key={saved.address}>
                        <div className="flex items-center gap-3 rounded-2xl bg-surface-container-low px-3 py-2.5 group">
                          <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-on-surface-variant/10 text-on-surface-variant">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" />
                            </svg>
                          </span>
                          <button
                            type="button"
                            onClick={() => pickLegacy(saved)}
                            className="min-w-0 flex-1 text-left"
                          >
                            <p className="truncate text-sm font-medium text-on-surface group-hover:text-primary transition">{saved.address}</p>
                          </button>
                          <button
                            type="button"
                            onClick={() => userId && removeLegacyHistory(userId, saved.address)}
                            className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-on-surface-variant hover:text-red-500 hover:bg-red-50 transition"
                            aria-label="Удалить"
                          >
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                            </svg>
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {/* Geolocate — switches to map view with point set */}
              <div className="flex items-center gap-3 pt-1">
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
            </>
          ) : (
            <>
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
            </>
          )}
        </div>
      </div>

      {token ? (
        <SavedAddressEditorModal
          open={editorOpen}
          token={token}
          onClose={() => setEditorOpen(false)}
          onSaved={(saved) => {
            setRemoteAddresses((prev) => {
              const ex = prev.find((x) => x.id === saved.id);
              return ex ? prev.map((x) => (x.id === saved.id ? saved : x)) : [saved, ...prev];
            });
          }}
        />
      ) : null}
    </div>
  );
}

type AddressRowProps = {
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

function AddressRow({ item, isNamed, onSelect, onRemove, onRename, isRenaming, nameInput, onNameInputChange, onSaveName, onCancelName }: AddressRowProps) {
  if (isRenaming) {
    return (
      <div className="flex items-center gap-2 rounded-2xl border border-primary/30 bg-primary/5 px-3 py-2.5">
        <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" />
          </svg>
        </span>
        <input
          type="text"
          value={nameInput}
          onChange={(e) => onNameInputChange(e.target.value.slice(0, 64))}
          placeholder="Дом, Работа..."
          className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-on-surface-variant"
          autoFocus
          onKeyDown={(e) => {
            if (e.key === "Enter") onSaveName();
            if (e.key === "Escape") onCancelName();
          }}
        />
        <button type="button" onClick={onSaveName} className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-emerald-600 hover:bg-emerald-50 transition" aria-label="Сохранить">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
        </button>
        <button type="button" onClick={onCancelName} className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-on-surface-variant hover:bg-surface-container-high transition" aria-label="Отмена">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
        </button>
      </div>
    );
  }

  return (
    <div className={`group flex items-center gap-3 rounded-2xl px-3 py-2.5 ${isNamed ? "border border-primary/30 bg-primary/5" : "bg-surface-container-low"}`}>
      <span className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full ${isNamed ? "bg-primary/15 text-primary" : "bg-on-surface-variant/10 text-on-surface-variant"}`}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" />
        </svg>
      </span>
      <button
        type="button"
        onClick={onSelect}
        className="min-w-0 flex-1 text-left"
        title={item.address}
      >
        {isNamed ? (
          <>
            <p className="truncate text-sm font-bold text-on-surface">{item.title}</p>
            <p className="truncate text-xs text-on-surface-variant">{item.address}</p>
          </>
        ) : (
          <p className="truncate text-sm font-medium text-on-surface group-hover:text-primary transition">{item.address}</p>
        )}
      </button>
      <button
        type="button"
        onClick={onRename}
        className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-on-surface-variant hover:text-primary hover:bg-primary/10 transition opacity-60 group-hover:opacity-100"
        aria-label={isNamed ? "Переименовать" : "Дать имя"}
        title={isNamed ? "Переименовать" : "Дать имя"}
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
      </button>
      <button
        type="button"
        onClick={onRemove}
        className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-on-surface-variant hover:text-red-500 hover:bg-red-50 transition opacity-60 group-hover:opacity-100"
        aria-label="Удалить"
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
          <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>
    </div>
  );
}

