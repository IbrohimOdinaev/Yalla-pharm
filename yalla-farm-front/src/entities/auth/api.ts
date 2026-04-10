import { apiFetch } from "@/shared/api/http-client";

export type RequestClientOtpResponse = {
  otpSessionId: string;
  phoneNumber: string;
  expiresAtUtc: string;
  resendAvailableAtUtc: string;
  codeLength: number;
  isNewClient: boolean;
};

export type LoginResponse = {
  userId: string;
  name: string;
  phoneNumber: string;
  role: number | string;
  accessToken: string;
  expiresAtUtc: string;
};

export async function requestClientOtp(phoneNumber: string): Promise<RequestClientOtpResponse> {
  return apiFetch<RequestClientOtpResponse>("/api/auth/otp/request", {
    method: "POST",
    body: { phoneNumber },
  });
}

export async function verifyClientOtp(
  otpSessionId: string,
  code: string,
  name?: string,
): Promise<LoginResponse> {
  return apiFetch<LoginResponse>("/api/auth/otp/verify", {
    method: "POST",
    body: { otpSessionId, code, name: name ?? null },
  });
}

export async function resendClientOtp(otpSessionId: string): Promise<RequestClientOtpResponse> {
  return apiFetch<RequestClientOtpResponse>("/api/auth/otp/resend", {
    method: "POST",
    body: { otpSessionId },
  });
}

export async function adminLogin(phoneNumber: string, password: string): Promise<LoginResponse> {
  return apiFetch<LoginResponse>("/api/auth/admin/login", {
    method: "POST",
    body: { phoneNumber, password },
  });
}

export async function superAdminLogin(phoneNumber: string, password: string): Promise<LoginResponse> {
  return apiFetch<LoginResponse>("/api/auth/super-admin/login", {
    method: "POST",
    body: { phoneNumber, password },
  });
}

// ───────────── Telegram bot deeplink auth ─────────────

export type StartTelegramAuthResponse = {
  nonce: string;
  deepLink: string;
  botUsername: string;
  expiresAtUtc: string;
  ttlSeconds: number;
};

export type PollTelegramAuthResponse = {
  status: "pending" | "confirmed" | "cancelled" | "expired" | "consumed";
};

export async function startTelegramAuth(): Promise<StartTelegramAuthResponse> {
  return apiFetch<StartTelegramAuthResponse>("/api/auth/telegram/start", {
    method: "POST",
    body: {},
  });
}

export async function completeTelegramAuth(nonce: string): Promise<LoginResponse> {
  return apiFetch<LoginResponse>("/api/auth/telegram/complete", {
    method: "POST",
    body: { nonce },
  });
}

export async function pollTelegramAuth(nonce: string): Promise<PollTelegramAuthResponse> {
  return apiFetch<PollTelegramAuthResponse>(`/api/auth/telegram/poll?nonce=${encodeURIComponent(nonce)}`);
}
