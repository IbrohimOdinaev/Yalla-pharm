"use client";

import { useState } from "react";
import Link from "next/link";
import { acceptPrivacyPolicy } from "@/entities/legal/api";
import { Button, Icon } from "@/shared/ui";

type Props = {
  open: boolean;
  token: string;
  /** Current backend-enforced version the client must accept. */
  version: string;
  onAccepted: () => void;
  onClose: () => void;
};

/**
 * Blocking modal that gates sensitive flows (prescription submit
 * today) when the client hasn't accepted the current privacy-policy
 * version. Two affordances: a deep link to the full policy text in a
 * new tab, and a single checkbox + confirm button — no "decline"
 * action, because declining here means the user simply can't proceed
 * with the action that opened the modal.
 *
 * State is local: `agreed` toggles the checkbox, `submitting` blocks
 * double-taps while the POST is in flight. Errors surface inline so
 * the user doesn't lose the modal.
 */
export function PrivacyPolicyAcceptanceModal({ open, token, version, onAccepted, onClose }: Props) {
  const [agreed, setAgreed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  async function handleAccept() {
    if (!agreed || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      await acceptPrivacyPolicy(token, version);
      onAccepted();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось сохранить согласие.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4">
      <div className="w-full max-w-lg rounded-t-3xl bg-surface p-5 pb-safe-5 shadow-float sm:rounded-3xl sm:pb-5">
        <div className="mb-4 flex items-start justify-between gap-3">
          <h2 className="font-display text-lg font-extrabold">
            Согласие на обработку персональных данных
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Закрыть"
            className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-on-surface-variant transition hover:bg-surface-container-low"
          >
            <Icon name="close" size={16} />
          </button>
        </div>

        <p className="text-sm leading-relaxed text-on-surface">
          Чтобы расшифровать рецепт, мы должны обработать ваши медицинские
          данные (фото рецепта). Это специальная категория персональных
          данных по Закону Республики Таджикистан № 1537.
        </p>

        <p className="mt-2 text-sm leading-relaxed text-on-surface-variant">
          Какие данные собираем, как используем и как защищаем — описано
          в политике обработки персональных данных (версия{" "}
          <span className="font-bold text-on-surface">{version}</span>).
        </p>

        <Link
          href="/privacy-policy"
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline"
        >
          <Icon name="search" size={14} />
          Открыть полный текст политики
        </Link>

        <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-2xl bg-surface-container-low p-3">
          <input
            type="checkbox"
            checked={agreed}
            onChange={(e) => setAgreed(e.target.checked)}
            className="mt-0.5 h-4 w-4 flex-shrink-0 accent-primary"
          />
          <span className="text-sm leading-snug">
            Я ознакомлен(а) с политикой обработки персональных данных и
            даю согласие на обработку моих данных, включая фотографии
            рецепта.
          </span>
        </label>

        {error ? (
          <div className="mt-3 rounded-2xl bg-secondary/10 p-3 text-sm text-secondary">
            {error}
          </div>
        ) : null}

        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          <Button
            type="button"
            variant="secondary"
            fullWidth
            onClick={onClose}
            disabled={submitting}
          >
            Отмена
          </Button>
          <Button
            type="button"
            fullWidth
            onClick={handleAccept}
            disabled={!agreed || submitting}
            loading={submitting}
          >
            Принимаю
          </Button>
        </div>
      </div>
    </div>
  );
}
