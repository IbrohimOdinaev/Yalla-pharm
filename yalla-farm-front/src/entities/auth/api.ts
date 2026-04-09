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
