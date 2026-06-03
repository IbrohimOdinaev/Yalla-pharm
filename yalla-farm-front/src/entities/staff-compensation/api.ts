import { apiFetch } from "@/shared/api/http-client";

export type StaffRole = "Admin" | "Pharmacist";
export type StaffPayoutMethod = "Cash" | "Transfer";

export type StaffCompensationSummary = {
  staffUserId: string;
  staffRole: StaffRole;
  earnedWorkItemsCount: number;
  earnedAmount: number;
  paidAmount: number;
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

export type StaffCompensationMe = {
  summary: StaffCompensationSummary;
  recentEarnings: StaffCompensationEarning[];
  recentPayouts: StaffCompensationPayout[];
};

export async function getStaffCompensationMe(token: string): Promise<StaffCompensationMe> {
  return apiFetch<StaffCompensationMe>("/api/staff-compensation/me", { token });
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
