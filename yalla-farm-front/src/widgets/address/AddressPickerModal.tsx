"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useDeliveryAddressStore, type SavedAddress } from "@/features/delivery/model/deliveryAddressStore";
import { useAppSelector } from "@/shared/lib/redux";
import { AddressAutocomplete } from "@/widgets/address/AddressAutocomplete";
import { getBrowserGeolocation, type GeoResult, type GeoPoint } from "@/shared/lib/map";
import type { PharmacyMapHandle } from "@/widgets/map/PharmacyMap";
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
  const savedAddresses = useDeliveryAddressStore((s) => s.savedAddresses);
  const loadHistory = useDeliveryAddressStore((s) => s.loadHistory);
  const saveToHistory = useDeliveryAddressStore((s) => s.saveToHistory);
  const removeFromHistory = useDeliveryAddressStore((s) => s.removeFromHistory);

  const userId = useAppSelector((s) => s.auth.userId);

  const [localAddress, setLocalAddress] = useState(address);
  const [localCoords, setLocalCoords] = useState<GeoPoint | null>(coords);
  const [geoLoading, setGeoLoading] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);
  const autoGeoTriggered = useRef(false);
  const mapHandleRef = useRef<PharmacyMapHandle | null>(null);

  /** Pan map to a point (called from autocomplete, geolocation, saved address) */
  function panMapTo(point: GeoPoint) {
    mapHandleRef.current?.panTo(point);
  }

  useEffect(() => {
    if (open) {
      setLocalAddress(address);
      setLocalCoords(coords);
      setGeoError(null);
      if (userId) loadHistory(userId);
    } else {
      autoGeoTriggered.current = false;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, address, coords, userId]);

  // Auto-geolocation on first open
  useEffect(() => {
    if (open && autoGeolocate && !autoGeoTriggered.current && !address) {
      autoGeoTriggered.current = true;
      doGeolocation();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, autoGeolocate, address]);

  // Lock body scroll
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
      return () => { document.body.style.overflow = ""; };
    }
  }, [open]);

  /** Called when user drags map — only update address text, don't pan */
  const handleMapDrag = useCallback(async (result: GeoResult) => {
    setLocalAddress(result.address);
    setLocalCoords({ lat: result.lat, lng: result.lng });
  }, []);

  function handleConfirm() {
    setAddressWithCoords(localAddress, localCoords);
    if (userId && localAddress.trim()) saveToHistory(userId);
    onClose();
  }

  function handleSelectSaved(saved: SavedAddress) {
    setLocalAddress(saved.address);
    setLocalCoords(saved.coords);
    if (saved.coords) panMapTo(saved.coords);
  }

  function handleRemoveSaved(addr: string) {
    if (userId) removeFromHistory(userId, addr);
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

  // Filter out the currently selected address from saved list
  const visibleSaved = savedAddresses.filter((s) => s.address !== localAddress);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto bg-surface rounded-2xl shadow-2xl" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
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

        {/* Body */}
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

          {/* Saved addresses (only for authorized users) */}
          {userId && visibleSaved.length > 0 ? (
            <div className="space-y-1.5">
              <p className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider">Ранее использованные</p>
              <div className="flex flex-wrap gap-1.5">
                {visibleSaved.map((saved) => (
                  <div key={saved.address} className="flex items-center gap-1 rounded-full bg-surface-container-low pl-3 pr-1 py-1 group">
                    <button
                      type="button"
                      onClick={() => handleSelectSaved(saved)}
                      className="flex items-center gap-1.5 text-xs font-medium text-on-surface hover:text-primary transition truncate max-w-[200px]"
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0 text-on-surface-variant">
                        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" />
                      </svg>
                      {saved.address}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRemoveSaved(saved.address)}
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
            {geoError ? (
              <span className="text-xs text-red-500">{geoError}</span>
            ) : null}
          </div>

          {/* Hint */}
          <p className="text-xs text-on-surface-variant">
            Передвигайте карту для выбора точки доставки или введите адрес выше
          </p>

          {/* Map */}
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
