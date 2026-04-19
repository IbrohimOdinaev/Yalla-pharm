"use client";

import { useEffect, useMemo, useState } from "react";
import { GoogleMap, useJsApiLoader, OverlayView } from "@react-google-maps/api";
import { env } from "@/shared/config/env";
import { formatMoney } from "@/shared/lib/format";
import {
  getDeliveryTariffs,
  dispatchDelivery,
  calculateDelivery,
  type DeliveryTariff,
} from "@/shared/api/delivery";
import type { ApiOrder } from "@/shared/types/api";

type Props = {
  open: boolean;
  token: string;
  order: ApiOrder;
  onClose: () => void;
  onDispatched: () => void;
};

const LIBRARIES: ("places")[] = ["places"];

const MAP_OPTIONS: google.maps.MapOptions = {
  disableDefaultUI: false,
  zoomControl: true,
  streetViewControl: false,
  mapTypeControl: false,
  fullscreenControl: false,
};

export function DispatchDeliveryModal({ open, token, order, onClose, onDispatched }: Props) {
  const { isLoaded } = useJsApiLoader({
    googleMapsApiKey: env.googleMapsApiKey,
    libraries: LIBRARIES,
  });

  const [tariffs, setTariffs] = useState<DeliveryTariff[]>([]);
  const [selectedTariffId, setSelectedTariffId] = useState<number | null>(null);
  const [isLoadingTariffs, setIsLoadingTariffs] = useState(false);
  const [isDispatching, setIsDispatching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [liveCost, setLiveCost] = useState<number | null>(null);
  const [liveDistance, setLiveDistance] = useState<number | null>(null);
  const [isCalculating, setIsCalculating] = useState(false);

  const fromPoint = useMemo(() => {
    if (order.fromLatitude != null && order.fromLongitude != null) {
      return { lat: order.fromLatitude, lng: order.fromLongitude };
    }
    return null;
  }, [order.fromLatitude, order.fromLongitude]);

  const toPoint = useMemo(() => {
    if (order.toLatitude != null && order.toLongitude != null) {
      return { lat: order.toLatitude, lng: order.toLongitude };
    }
    return null;
  }, [order.toLatitude, order.toLongitude]);

  const center = fromPoint ?? toPoint ?? { lat: 38.5598, lng: 68.7738 };

  useEffect(() => {
    if (!open) return;
    setError(null);
    setIsLoadingTariffs(true);
    getDeliveryTariffs(token)
      .then((list) => {
        setTariffs(list);
        if (list.length > 0) setSelectedTariffId(list[0].id);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Не удалось загрузить тарифы.");
      })
      .finally(() => setIsLoadingTariffs(false));
  }, [open, token]);

  // Live cost calculation: on open and whenever tariff changes.
  useEffect(() => {
    if (!open) return;
    if (!order.pharmacyId || order.toLatitude == null || order.toLongitude == null) return;

    let cancelled = false;
    setIsCalculating(true);
    calculateDelivery({
      pharmacyId: order.pharmacyId,
      toTitle: order.deliveryAddress ?? "",
      toAddress: order.deliveryAddress ?? "",
      toLatitude: order.toLatitude,
      toLongitude: order.toLongitude,
    })
      .then((r) => {
        if (cancelled) return;
        setLiveCost(r.deliveryCost);
        setLiveDistance(r.distance);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Не удалось рассчитать стоимость доставки.");
      })
      .finally(() => {
        if (!cancelled) setIsCalculating(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, order.pharmacyId, order.toLatitude, order.toLongitude, order.deliveryAddress, selectedTariffId]);

  async function onConfirm() {
    setError(null);
    setIsDispatching(true);
    try {
      await dispatchDelivery(token, order.orderId, selectedTariffId);
      onDispatched();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось вызвать доставку.");
    } finally {
      setIsDispatching(false);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4">
      <div className="bg-surface w-full sm:max-w-xl rounded-t-2xl sm:rounded-2xl shadow-xl max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-surface-container-high p-4">
          <h2 className="text-lg font-bold">Вызвать доставку</h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-surface-container-low"
            aria-label="Закрыть"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12" /></svg>
          </button>
        </div>

        <div className="p-4 space-y-4">
          {error && <div className="rounded-xl bg-red-100 p-3 text-sm text-red-700">{error}</div>}

          {/* Map */}
          <div className="rounded-xl overflow-hidden border border-surface-container-high">
            {isLoaded ? (
              <GoogleMap
                mapContainerClassName="w-full h-48 sm:h-56"
                center={center}
                zoom={13}
                options={MAP_OPTIONS}
              >
                {fromPoint && (
                  <OverlayView position={fromPoint} mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}>
                    <div
                      className="w-4 h-4 rounded-full bg-primary border-2 border-white shadow-lg"
                      style={{ transform: "translate(-50%, -50%)" }}
                      title="Аптека"
                    />
                  </OverlayView>
                )}
                {toPoint && (
                  <OverlayView position={toPoint} mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}>
                    <div
                      className="w-4 h-4 rounded-full bg-red-500 border-2 border-white shadow-lg"
                      style={{ transform: "translate(-50%, -50%)" }}
                      title="Клиент"
                    />
                  </OverlayView>
                )}
              </GoogleMap>
            ) : (
              <div className="w-full h-48 sm:h-56 flex items-center justify-center bg-surface-container-low">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              </div>
            )}
          </div>

          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-primary" /> Аптека
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-red-500" /> Клиент
            </div>
          </div>

          {/* Addresses */}
          <div className="space-y-1 text-sm">
            <div className="flex justify-between gap-2">
              <span className="text-on-surface-variant flex-shrink-0">Откуда</span>
              <span className="text-right">{order.pharmacyTitle ?? "Аптека"}</span>
            </div>
            <div className="flex justify-between gap-2">
              <span className="text-on-surface-variant flex-shrink-0">Куда</span>
              <span className="text-right">{order.deliveryAddress ?? "—"}</span>
            </div>
            {(liveDistance ?? order.deliveryDistance) != null && (
              <div className="flex justify-between gap-2">
                <span className="text-on-surface-variant">Расстояние</span>
                <span>{(liveDistance ?? order.deliveryDistance!).toFixed(1)} км</span>
              </div>
            )}
            <div className="flex justify-between gap-2 pt-1 border-t border-surface-container-high">
              <span className="text-on-surface-variant">Стоимость доставки</span>
              <span className="font-bold">
                {isCalculating
                  ? "..."
                  : (liveCost ?? order.deliveryCost) != null
                    ? formatMoney(liveCost ?? order.deliveryCost!, order.currency)
                    : "—"}
              </span>
            </div>
          </div>

          {/* Tariffs */}
          <div className="space-y-2">
            <label className="text-sm font-bold">Тариф</label>
            {isLoadingTariffs ? (
              <p className="text-sm text-on-surface-variant">Загрузка тарифов…</p>
            ) : tariffs.length === 0 ? (
              <p className="text-sm text-on-surface-variant">Нет доступных тарифов — будет использован тариф по умолчанию.</p>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {tariffs.map((t) => {
                  const active = selectedTariffId === t.id;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setSelectedTariffId(t.id)}
                      className={`rounded-xl border-2 px-3 py-2 text-sm text-left transition ${active
                        ? "border-primary bg-primary/10 font-semibold"
                        : "border-surface-container-high hover:border-primary/50"
                        }`}
                    >
                      {t.name}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <div className="sticky bottom-0 bg-surface border-t border-surface-container-high p-4 flex gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={isDispatching}
            className="stitch-button-secondary flex-1 py-3"
          >
            Отмена
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isDispatching || isLoadingTariffs}
            className="stitch-button flex-1 py-3"
          >
            {isDispatching ? "Отправка…" : "Подтвердить"}
          </button>
        </div>
      </div>
    </div>
  );
}
