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

export async function calculateDelivery(
  request: CalculateDeliveryRequest
): Promise<CalculateDeliveryResponse> {
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
