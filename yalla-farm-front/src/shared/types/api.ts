export type ApiPaginated<T> = {
  page?: number;
  pageSize?: number;
  totalCount?: number;
  medicines?: T[];
};

export type ApiMedicineImage = {
  id?: string;
  url?: string;
  key?: string;
  isMain?: boolean;
  isMinimal?: boolean;
};

export type ApiMedicineAttribute = {
  type: string;
  value: string;
  name?: string;
  option?: string;
};

export type ApiCategory = {
  id: string;
  name: string;
  slug: string;
  parentId?: string | null;
  type?: string | null;
  wooCommerceId: number;
  isActive: boolean;
  children: ApiCategory[];
};

export type ApiMedicineOffer = {
  pharmacyId: string;
  pharmacyTitle?: string;
  stockQuantity: number;
  price: number;
};

export type ApiMedicine = {
  id: string;
  title?: string;
  name?: string;
  articul?: string;
  isActive?: boolean;
  description?: string;
  dosage?: string;
  releaseForm?: string;
  manufacturer?: string;
  price?: number;
  minPrice?: number;
  categoryId?: string;
  categoryName?: string;
  images?: ApiMedicineImage[];
  atributes?: ApiMedicineAttribute[];
  offers?: ApiMedicineOffer[];
};

export type ApiBasketPosition = {
  id: string;
  medicineId: string;
  quantity: number;
  medicine?: ApiMedicine;
  price?: number;
};

export type ApiBasketPharmacyItem = {
  medicineId: string;
  requestedQuantity: number;
  isFound: boolean;
  foundQuantity: number;
  hasEnoughQuantity: boolean;
  price?: number | null;
};

export type ApiBasketPharmacyOption = {
  pharmacyId: string;
  pharmacyTitle?: string;
  pharmacyIsActive?: boolean;
  totalCost?: number;
  isAvailable?: boolean;
  foundMedicinesCount?: number;
  totalMedicinesCount?: number;
  enoughQuantityMedicinesCount?: number;
  foundMedicinesRatio?: string;
  items?: ApiBasketPharmacyItem[];
};

export type ApiBasket = {
  positions?: ApiBasketPosition[];
  pharmacyOptions?: ApiBasketPharmacyOption[];
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

/* ── Client profile ── */

export type ApiClient = {
  clientId: string;
  name: string;
  phoneNumber: string;
  gender?: number | null;
  dateOfBirth?: string | null;
  telegramId?: number | null;
  telegramUsername?: string | null;
};

/* ── Orders ── */

export type ApiOrderPosition = {
  positionId: string;
  medicineId: string;
  medicine?: ApiMedicine;
  quantity: number;
  returnedQuantity?: number;
  price: number;
  isRejected?: boolean;
};

export type ApiRefundRequest = {
  refundRequestId: string;
  orderId?: string;
  reason?: string;
  status?: string;
  amount?: number;
  currency?: string;
  createdAt?: string;
};

export type ApiOrder = {
  orderId: string;
  status: string;
  paymentState?: string;
  clientId?: string;
  pharmacyId?: string;
  pharmacyTitle?: string;
  deliveryAddress?: string;
  isPickup?: boolean;
  createdAtUtc?: string;
  cost?: number;
  currency?: string;
  returnCost?: number;
  clientPhoneNumber?: string;
  clientName?: string | null;
  clientTelegramId?: number | null;
  clientTelegramUsername?: string | null;
  orderPlacedAt?: string;
  paymentUrl?: string;
  paymentExpiresAtUtc?: string | null;
  comment?: string | null;
  positions?: ApiOrderPosition[];
  refundRequest?: ApiRefundRequest;
  // Delivery
  deliveryCost?: number;
  deliveryDistance?: number;
  totalCost?: number;
  juraOrderId?: number | null;
  juraStatus?: string | null;
  juraStatusId?: number | null;
  recipientCode?: string | null;
  driverName?: string | null;
  driverPhone?: string | null;
  fromLatitude?: number | null;
  fromLongitude?: number | null;
  toLatitude?: number | null;
  toLongitude?: number | null;
};

/* ── Search ── */

export type ApiSearchResult = {
  medicines: ApiMedicine[];
  totalCount?: number;
  page?: number;
  pageSize?: number;
};

/* ── Search by pharmacy ── */

export type ApiPharmacyMedicinesGroup = {
  pharmacyId: string;
  pharmacyTitle: string;
  totalInPharmacy: number;
  medicines: ApiMedicine[];
};

export type ApiSearchByPharmacyResponse = {
  query: string;
  totalCount: number;
  pharmacies: ApiPharmacyMedicinesGroup[];
};
