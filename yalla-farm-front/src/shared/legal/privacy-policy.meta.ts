/**
 * Privacy policy metadata — must stay in sync with the corresponding
 * backend value `Compliance:PrivacyPolicyCurrentVersion` in
 * `yalla-back/Api/appsettings.json`. Frontend uses `version` to:
 *   • detect whether the logged-in client already accepted this rev,
 *   • POST the right value back when the client accepts,
 *   • display effectiveDate on the policy page.
 *
 * IMPORTANT: bumping `version` requires every existing client to
 * re-accept on next login. Keep the bump in lock-step with the
 * appsettings.json value or the gate falls over.
 */
export const PRIVACY_POLICY_META = {
  version: "1.0-2026-05-12",
  effectiveDate: "2026-05-12",
} as const;

export type PrivacyPolicyMeta = typeof PRIVACY_POLICY_META;
