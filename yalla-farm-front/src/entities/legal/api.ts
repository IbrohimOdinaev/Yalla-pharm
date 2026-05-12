import { apiFetch } from "@/shared/api/http-client";

export type ApiPrivacyPolicyMeta = {
  version: string;
  effectiveDate: string;
};

/** Anonymous endpoint — the register screen pulls this before the
 *  user has a token, so don't add an Authorization header. */
export async function getPrivacyPolicyMeta(): Promise<ApiPrivacyPolicyMeta> {
  return apiFetch<ApiPrivacyPolicyMeta>("/api/legal/privacy-policy");
}

/** Records the current client's acceptance. Backend rejects with 400 if
 *  the supplied version doesn't match the configured current version —
 *  callers should always pass the value from getPrivacyPolicyMeta() to
 *  avoid that race. */
export async function acceptPrivacyPolicy(token: string, version: string): Promise<void> {
  await apiFetch<unknown>("/api/clients/me/accept-privacy-policy", {
    method: "POST",
    token,
    body: { version },
  });
}

export type ApiPrivacyPolicyStatus = {
  accepted: boolean;
  acceptedVersion: string | null;
  currentVersion: string;
};

/** Per-client status — tells the SPA whether to render the accept
 *  modal before sensitive flows. */
export async function getPrivacyPolicyStatus(token: string): Promise<ApiPrivacyPolicyStatus> {
  return apiFetch<ApiPrivacyPolicyStatus>("/api/clients/me/privacy-policy-status", { token });
}
