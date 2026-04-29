import { apiFetch } from "./http-client";

export type CalculateDeliveryRequest = {
  pharmacyId: string;
  toAddressId?: number | null;
  toTitle: string;
  toAddress: string;
  toLatitude: number;
  toLongitude: number;
};

export type CalculateDeliveryResponse = {
  deliveryCost: number;
  distance: number;
};

export type DriverPositionResponse = {
  lat: number;
  lng: number;
};

export type DeliveryStatusResponse = {
  juraStatus: string;
  juraStatusId?: number;
  driverName?: string;
  driverPhone?: string;
  deliveryCost: number;
};

/**
 * Reject a delivery calc request before it leaves the browser when the
 * destination coords are missing or out of the valid Mercator range. The
 * backend (and JURA below it) returns 400 for these payloads — failing fast
 * keeps the network panel quiet and lets callers surface a UX error instead
 * of waiting for a doomed roundtrip.
 */
function isValidCoord(lat: unknown, lng: unknown): boolean {
  return (
    typeof lat === "number" && Number.isFinite(lat) && lat >= -90 && lat <= 90 &&
    typeof lng === "number" && Number.isFinite(lng) && lng >= -180 && lng <= 180
  );
}

export class DeliveryCoordError extends Error {
  constructor() {
    super("Координаты адреса доставки не определены. Выберите адрес из подсказок или на карте.");
    this.name = "DeliveryCoordError";
  }
}

export async function calculateDelivery(
  request: CalculateDeliveryRequest
): Promise<CalculateDeliveryResponse> {
  if (!isValidCoord(request.toLatitude, request.toLongitude)) {
    throw new DeliveryCoordError();
  }
  return apiFetch<CalculateDeliveryResponse>("/api/delivery/calculate", {
    method: "POST",
    body: request,
  });
}

export async function getDriverPosition(
  token: string,
  orderId: string
): Promise<DriverPositionResponse> {
  return apiFetch<DriverPositionResponse>(
    `/api/delivery/${orderId}/driver-position`,
    { token }
  );
}

export async function getDeliveryStatus(
  token: string,
  orderId: string
): Promise<DeliveryStatusResponse> {
  return apiFetch<DeliveryStatusResponse>(
    `/api/delivery/${orderId}/status`,
    { token }
  );
}

export type DeliveryTariff = {
  id: number;
  name: string;
  divisionId: number;
};

export async function getDeliveryTariffs(token: string): Promise<DeliveryTariff[]> {
  return apiFetch<DeliveryTariff[]>("/api/delivery/tariffs", { token });
}

export type DispatchDeliveryResponse = {
  orderId: string;
  juraOrderId: number;
  juraStatus: string;
  juraStatusId: number;
  deliveryCost: number;
  driverName?: string;
  driverPhone?: string;
  alreadyDispatched: boolean;
};

export async function dispatchDelivery(
  token: string,
  orderId: string,
  tariffId: number | null
): Promise<DispatchDeliveryResponse> {
  return apiFetch<DispatchDeliveryResponse>(
    `/api/orders/${orderId}/delivery/dispatch`,
    { method: "POST", token, body: { tariffId } }
  );
}

export async function cancelDelivery(
  token: string,
  orderId: string,
  reason?: string
): Promise<{ orderId: string; cancelled: boolean }> {
  return apiFetch(
    `/api/orders/${orderId}/delivery/cancel`,
    { method: "POST", token, body: { reason: reason ?? null } }
  );
}
