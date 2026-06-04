import { apiFetch } from "@/shared/api/http-client";

export type PharmacyWithdrawalBank = "DushanbeCity" | "Alif" | "Eskhata" | 0 | 1 | 2;
export type PharmacyWithdrawalStatus = "New" | "Completed" | 0 | 1;

export type PharmacyFinanceSummary = {
  pharmacyId: string;
  pharmacyTitle: string;
  totalOrderAmount: number;
  completedWithdrawalAmount: number;
  pendingWithdrawalAmount: number;
  availableAmount: number;
  completedOrdersCount: number;
  currency: string;
};

export type PharmacyWithdrawalRequest = {
  id: string;
  pharmacyId: string;
  pharmacyTitle: string;
  requestedByAdminId: string;
  requestedByAdminName: string;
  requestedByAdminPhoneNumber: string;
  amount: number;
  currency: string;
  bank: PharmacyWithdrawalBank;
  bankLabel: string;
  walletPhoneNumber: string;
  deepLinkUrl: string;
  status: PharmacyWithdrawalStatus;
  createdAtUtc: string;
  completedAtUtc?: string | null;
  completedBySuperAdminId?: string | null;
  receiptImageUrl?: string | null;
  superAdminComment?: string | null;
};

export type PharmacyFinanceResponse = {
  summary: PharmacyFinanceSummary;
  withdrawalRequests: PharmacyWithdrawalRequest[];
};

export function withdrawalStatusLabel(status: PharmacyWithdrawalStatus): "Новый" | "Выполненный" {
  return status === "Completed" || status === 1 ? "Выполненный" : "Новый";
}

export function withdrawalBankValue(bank: PharmacyWithdrawalBank): "DushanbeCity" | "Alif" | "Eskhata" {
  if (bank === 0 || bank === "DushanbeCity") return "DushanbeCity";
  if (bank === 1 || bank === "Alif") return "Alif";
  return "Eskhata";
}

export async function getAdminPharmacyFinance(token: string): Promise<PharmacyFinanceResponse> {
  return apiFetch<PharmacyFinanceResponse>("/api/pharmacy-finance/admin", { token });
}

export async function createPharmacyWithdrawalRequest(
  token: string,
  input: { bank: "DushanbeCity" | "Alif" | "Eskhata"; walletPhoneNumber: string },
): Promise<PharmacyWithdrawalRequest> {
  return apiFetch<PharmacyWithdrawalRequest>("/api/pharmacy-finance/admin/withdrawals", {
    method: "POST",
    token,
    body: { bank: input.bank, walletPhoneNumber: input.walletPhoneNumber },
  });
}

export async function getSuperAdminPharmacyWithdrawals(token: string): Promise<PharmacyFinanceResponse> {
  return apiFetch<PharmacyFinanceResponse>("/api/pharmacy-finance/superadmin/withdrawals", { token });
}

export async function completePharmacyWithdrawalRequest(
  token: string,
  input: { withdrawalRequestId: string; receipt: File; comment?: string },
): Promise<PharmacyWithdrawalRequest> {
  const body = new FormData();
  body.append("receipt", input.receipt);
  if (input.comment) body.append("comment", input.comment);
  return apiFetch<PharmacyWithdrawalRequest>(
    `/api/pharmacy-finance/superadmin/withdrawals/${encodeURIComponent(input.withdrawalRequestId)}/complete`,
    { method: "POST", token, body },
  );
}
