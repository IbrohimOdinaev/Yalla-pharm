import type { Metadata } from "next";
import { PRIVACY_POLICY_META } from "@/shared/legal/privacy-policy.meta";

export const metadata: Metadata = {
  title: "Политика обработки данных",
  description: `Политика обработки персональных данных Yalla Pharm. Версия ${PRIVACY_POLICY_META.version}, действует с ${PRIVACY_POLICY_META.effectiveDate}.`,
  alternates: {
    canonical: "/privacy-policy",
  },
};

export default function PrivacyPolicyLayout({ children }: { children: React.ReactNode }) {
  return children;
}
