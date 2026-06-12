import { apiFetch } from "@/shared/api/http-client";

export type ApiUserRole = "Client" | "Admin" | "SuperAdmin" | "Pharmacist" | 0 | 1 | 2 | 3;

export type ApiUserOrderListItem = {
  orderId: string;
  pharmacyId: string;
  orderPlacedAt: string;
  status: string | number;
  cost: number;
};

export type ApiUserListItem = {
  userId: string;
  name: string;
  phoneNumber: string;
  role: ApiUserRole;
  isActive: boolean;
  authType: "Password" | "OTP" | "Telegram" | string;
  hasPasswordLogin: boolean;
  avatarUrl?: string | null;
  gender?: string | number | null;
  dateOfBirth?: string | null;
  telegramId?: number | null;
  telegramUsername?: string | null;
  deactivatedAtUtc?: string | null;
  deactivatedByUserId?: string | null;
  deactivationReason?: string | null;
  pharmacyId?: string | null;
  pharmacyTitle?: string | null;
  pharmacyIsActive?: boolean | null;
  ordersCount: number;
  orders: ApiUserOrderListItem[];
};

export type GetUsersResponse = {
  role?: ApiUserRole | null;
  page: number;
  pageSize: number;
  totalCount: number;
  users: ApiUserListItem[];
};

export async function getUsers(
  token: string,
  input: { query?: string; role?: ApiUserRole | ""; page?: number; pageSize?: number } = {},
): Promise<GetUsersResponse> {
  const params = new URLSearchParams();
  params.set("page", String(input.page ?? 1));
  params.set("pageSize", String(input.pageSize ?? 100));
  if (input.query?.trim()) params.set("query", input.query.trim());
  if (input.role !== undefined && input.role !== "") params.set("role", String(input.role));
  return apiFetch<GetUsersResponse>(`/api/users?${params.toString()}`, { token });
}
