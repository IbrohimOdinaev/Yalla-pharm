"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/widgets/layout/AppShell";
import { TopBar } from "@/widgets/layout/TopBar";
import { PRIVACY_POLICY_META } from "@/shared/legal/privacy-policy.meta";

/**
 * Read-only viewer for the Russian-language privacy policy. The
 * markdown source lives in `/public/legal/privacy-policy.md` so the
 * SPA can fetch it without an extra build step and without a markdown
 * loader dep. Rendering is intentionally simple — pre-formatted block
 * with mono-ish system font that preserves headings and lists exactly
 * as written, and avoids any in-browser markdown interpreter that
 * could subtly alter a legal document the user is consenting to.
 *
 * If/when the policy is approved by counsel we can upgrade to proper
 * markdown rendering — until then the visual rawness is a feature.
 */
export default function PrivacyPolicyPage() {
  const [text, setText] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/legal/privacy-policy.md")
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.text();
      })
      .then(setText)
      .catch((e) => setError(e instanceof Error ? e.message : "Не удалось загрузить документ."));
  }, []);

  return (
    <AppShell top={<TopBar title="Политика обработки данных" backHref="back" />}>
      <div className="mx-auto max-w-3xl px-4 pb-12 pt-4 sm:px-6">
        <div className="mb-4 rounded-2xl bg-warning-soft p-3 text-xs text-on-surface-variant">
          Версия документа: <span className="font-bold">{PRIVACY_POLICY_META.version}</span>
          {" · "}
          Дата вступления в силу: <span className="font-bold">{PRIVACY_POLICY_META.effectiveDate}</span>
        </div>

        {error ? (
          <div className="rounded-2xl bg-secondary/10 p-4 text-sm text-secondary">
            {error}
          </div>
        ) : !text ? (
          <div className="rounded-2xl bg-surface-container-low p-4 text-sm text-on-surface-variant">
            Загружаем документ…
          </div>
        ) : (
          <pre className="whitespace-pre-wrap break-words rounded-2xl bg-surface-container-lowest p-4 text-[13px] leading-relaxed text-on-surface shadow-card">
            {text}
          </pre>
        )}
      </div>
    </AppShell>
  );
}
