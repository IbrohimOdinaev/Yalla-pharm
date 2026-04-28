"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import dynamic from "next/dynamic";
import { AddressAutocomplete } from "@/widgets/address/AddressAutocomplete";
import { getBrowserGeolocation, type GeoResult, type GeoPoint } from "@/shared/lib/map";
import type { PharmacyMapHandle } from "@/widgets/map/PharmacyMap";
import { upsertMyAddress, updateMyAddress, type ClientAddress } from "@/entities/client/api";
import { Button } from "@/shared/ui";

const PharmacyMap = dynamic(() => import("@/widgets/map/PharmacyMap").then((m) => m.PharmacyMap), { ssr: false });

type Props = {
  open: boolean;
  token: string;
  initial?: ClientAddress | null;
  onClose: () => void;
  onSaved: (saved: ClientAddress) => void;
};

export function SavedAddressEditorModal({ open, token, initial, onClose, onSaved }: Props) {
  const [address, setAddress] = useState("");
  const [coords, setCoords] = useState<GeoPoint | null>(null);
  const [title, setTitle] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [geoLoading, setGeoLoading] = useState(false);
  const mapHandleRef = useRef<PharmacyMapHandle | null>(null);

  useEffect(() => {
    if (open) {
      setAddress(initial?.address ?? "");
      setCoords(initial ? { lat: initial.latitude, lng: initial.longitude } : null);
      setTitle(initial?.title ?? "");
      setError(null);
    }
  }, [open, initial]);

  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
      return () => { document.body.style.overflow = ""; };
    }
  }, [open]);

  const panMapTo = useCallback((point: GeoPoint) => {
    mapHandleRef.current?.panTo(point);
  }, []);

  const handleMapDrag = useCallback((result: GeoResult) => {
    setAddress(result.address);
    setCoords({ lat: result.lat, lng: result.lng });
  }, []);

  async function doGeolocation() {
    setGeoLoading(true);
    setError(null);
    try {
      const point = await getBrowserGeolocation();
      const { getMapProvider } = await import("@/shared/lib/map");
      const result = await getMapProvider().reverseGeocode(point);
      if (result) {
        setAddress(result.address);
        setCoords({ lat: result.lat, lng: result.lng });
        panMapTo({ lat: result.lat, lng: result.lng });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось определить местоположение");
    }
    setGeoLoading(false);
  }

  async function handleSave() {
    const trimmedAddress = address.trim();
    const trimmedTitle = title.trim();
    if (!trimmedTitle) { setError("Введите название адреса"); return; }
    if (!trimmedAddress || !coords) { setError("Выберите адрес на карте или через поиск"); return; }

    setSaving(true);
    setError(null);
    try {
      let saved: ClientAddress;
      if (initial) {
        saved = await updateMyAddress(token, initial.id, {
          address: trimmedAddress,
          title: trimmedTitle,
          latitude: coords.lat,
          longitude: coords.lng,
        });
      } else {
        saved = await upsertMyAddress(token, {
          address: trimmedAddress,
          title: trimmedTitle,
          latitude: coords.lat,
          longitude: coords.lng,
        });
      }
      onSaved(saved);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось сохранить адрес");
    } finally {
      setSaving(false);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto bg-surface rounded-2xl shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-surface-container-high">
          <h2 className="text-base sm:text-lg font-bold text-on-surface">
            {initial ? "Изменить адрес" : "Новый адрес"}
          </h2>
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
          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold text-on-surface-variant">Название</span>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value.slice(0, 64))}
              placeholder="Дом, Работа, Дача..."
              className="w-full rounded-xl bg-surface-container-low px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/40"
              autoFocus
            />
          </label>

          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold text-on-surface-variant">Адрес</span>
            <AddressAutocomplete
              value={address}
              onChange={setAddress}
              onCoordinatesChange={(c) => { if (c) { setCoords(c); panMapTo(c); } }}
              placeholder="Улица, дом, район..."
            />
          </label>

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
          </div>

          <p className="text-xs text-on-surface-variant">
            Передвигайте карту, чтобы уточнить точку, или ищите адрес выше
          </p>

          <PharmacyMap
            className="h-[300px] sm:h-[400px] rounded-xl overflow-hidden"
            pharmacies={[]}
            selectedPoint={coords}
            centerPinMode
            onCenterChange={handleMapDrag}
            mapHandle={(h) => { mapHandleRef.current = h; }}
          />

          {error ? (
            <div className="rounded-xl bg-secondary/10 p-3 text-sm font-semibold text-secondary">
              {error}
            </div>
          ) : null}

          <div className="flex gap-2 pt-1">
            <Button variant="secondary" size="md" fullWidth onClick={onClose} disabled={saving}>
              Отмена
            </Button>
            <Button size="md" fullWidth loading={saving} onClick={handleSave}>
              {initial ? "Сохранить" : "Добавить"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
