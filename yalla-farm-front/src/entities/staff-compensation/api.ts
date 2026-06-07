import { apiFetch } from "@/shared/api/http-client";

export type StaffRole = "Admin" | "Pharmacist";
export type StaffPayoutMethod = "Cash" | "Transfer";
export type StaffPayoutBank = "DushanbeCity" | "Alif" | "Eskhata" | 0 | 1 | 2;
export type StaffPayoutRequestStatus = "New" | "Completed" | 0 | 1;

export type StaffCompensationSummary = {
  staffUserId: string;
  staffRole: StaffRole;
  earnedWorkItemsCount: number;
  earnedAmount: number;
  paidAmount: number;
  pendingPayoutAmount?: number;
  balanceAmount: number;
  currency: string;
};

export type StaffCompensationEarning = {
  id: string;
  sourceType: "OrderReady" | "PrescriptionDecoded";
  sourceId: string;
  amount: number;
  currency: string;
  createdAtUtc: string;
};

export type StaffCompensationPayout = {
  id: string;
  amount: number;
  currency: string;
  method: StaffPayoutMethod;
  receiptImageUrl?: string | null;
  note?: string | null;
  paidAtUtc: string;
};

export type StaffCompensationPayoutRequest = {
  id: string;
  staffUserId: string;
  staffName: string;
  staffPhoneNumber: string;
  staffRole: StaffRole;
  pharmacyId?: string | null;
  pharmacyTitle?: string | null;
  amount: number;
  currency: string;
  bank: StaffPayoutBank;
  bankLabel: string;
  walletPhoneNumber: string;
  deepLinkUrl: string;
  status: StaffPayoutRequestStatus;
  createdAtUtc: string;
  completedAtUtc?: string | null;
  completedBySuperAdminId?: string | null;
  payoutId?: string | null;
  receiptImageUrl?: string | null;
  note?: string | null;
};

export type StaffCompensationMe = {
  summary: StaffCompensationSummary;
  recentEarnings: StaffCompensationEarning[];
  recentPayouts: StaffCompensationPayout[];
  recentPayoutRequests?: StaffCompensationPayoutRequest[];
};

export async function getStaffCompensationMe(token: string): Promise<StaffCompensationMe> {
  return apiFetch<StaffCompensationMe>("/api/staff-compensation/me", { token });
}

export function staffPayoutRequestStatusLabel(status: StaffPayoutRequestStatus): "Новый" | "Выполненный" {
  return status === "Completed" || status === 1 ? "Выполненный" : "Новый";
}

export function staffPayoutBankValue(bank: StaffPayoutBank): "DushanbeCity" | "Alif" | "Eskhata" {
  if (bank === 0 || bank === "DushanbeCity") return "DushanbeCity";
  if (bank === 1 || bank === "Alif") return "Alif";
  return "Eskhata";
}

export async function createStaffPayout(
  token: string,
  input: {
    staffUserId: string;
    amount: number;
    method: StaffPayoutMethod;
    note?: string;
    receipt?: File | null;
  },
): Promise<StaffCompensationPayout> {
  const body = new FormData();
  body.append("staffUserId", input.staffUserId);
  body.append("amount", String(input.amount));
  body.append("method", input.method);
  if (input.note) body.append("note", input.note);
  if (input.receipt) body.append("receipt", input.receipt);
  return apiFetch<StaffCompensationPayout>("/api/staff-compensation/payouts", { method: "POST", token, body });
}

export async function createStaffPayoutRequest(
  token: string,
  input: { bank: StaffPayoutBank; walletPhoneNumber: string },
): Promise<StaffCompensationPayoutRequest> {
  return apiFetch<StaffCompensationPayoutRequest>("/api/staff-compensation/payout-requests", {
    method: "POST",
    token,
    body: input,
  });
}

export async function getStaffPayoutRequests(token: string): Promise<StaffCompensationPayoutRequest[]> {
  const response = await apiFetch<{ payoutRequests?: StaffCompensationPayoutRequest[] }>("/api/staff-compensation/payout-requests", { token });
  return Array.isArray(response.payoutRequests) ? response.payoutRequests : [];
}

export async function completeStaffPayoutRequest(
  token: string,
  input: { payoutRequestId: string; receipt: File; note?: string },
): Promise<StaffCompensationPayoutRequest> {
  const body = new FormData();
  body.append("receipt", input.receipt);
  if (input.note) body.append("note", input.note);
  return apiFetch<StaffCompensationPayoutRequest>(
    `/api/staff-compensation/payout-requests/${encodeURIComponent(input.payoutRequestId)}/complete`,
    { method: "POST", token, body },
  );
}
