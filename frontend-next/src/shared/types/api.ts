export type ApiPaginated<T> = {
  page?: number;
  pageSize?: number;
  totalCount?: number;
  medicines?: T[];
};

export type ApiMedicineImage = {
  id?: string;
  url?: string;
};

export type ApiMedicine = {
  id: string;
  title?: string;
  name?: string;
  description?: string;
  dosage?: string;
  releaseForm?: string;
  manufacturer?: string;
  price?: number;
  images?: ApiMedicineImage[];
};

export type ApiBasketPosition = {
  id: string;
  medicineId: string;
  quantity: number;
  medicine?: ApiMedicine;
  price?: number;
};

export type ApiBasket = {
  positions?: ApiBasketPosition[];
  pharmacyOptions?: Array<{
    pharmacyId: string;
    pharmacyTitle?: string;
    pharmacyAddress?: string;
    totalCost?: number;
    isAvailable?: boolean;
    foundMedicinesCount?: number;
    totalMedicinesCount?: number;
    enoughQuantityMedicinesCount?: number;
    foundMedicinesRatio?: string;
  }>;
};

export type ApiCheckoutResponse = {
  orderId?: string;
  reservedOrderId?: string;
  paymentIntentId?: string;
  paymentUrl?: string;
  paymentExpiresAtUtc?: string | null;
  cost?: number;
  amount?: number;
  currency?: string;
  status?: number;
  paymentState?: number;
};

export type ApiPaymentIntentByIdResponse = {
  orderId?: string | null;
  paymentIntent?: {
    id: string;
    state: number;
    paymentUrl?: string;
    amount?: number;
    currency?: string;
  };
};
