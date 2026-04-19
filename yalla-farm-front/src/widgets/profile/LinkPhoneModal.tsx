"use client";

import { useState } from "react";
import { requestPhoneLink, verifyPhoneLink } from "@/entities/client/api";

type Props = {
  open: boolean;
  token: string;
  onClose: () => void;
  onSuccess: (phoneNumber: string) => void;
};

export function LinkPhoneModal({ open, token, onClose, onSuccess }: Props) {
  const [step, setStep] = useState<"phone" | "code">("phone");
  const [phone, setPhone] = useState("");
  const [otpSessionId, setOtpSessionId] = useState<string>("");
  const [code, setCode] = useState("");
  const [codeLength, setCodeLength] = useState(4);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!open) return null;

  function reset() {
    setStep("phone");
    setPhone("");
    setCode("");
    setOtpSessionId("");
    setError(null);
    setIsSubmitting(false);
  }

  function close() {
    reset();
    onClose();
  }

  function normalizedPhone(): string | null {
    const digits = phone.replace(/\D/g, "");
    if (digits.startsWith("992") && digits.length === 12) return digits.slice(3);
    if (digits.length === 9) return digits;
    return null;
  }

  async function onSendCode() {
    setError(null);
    const n = normalizedPhone();
    if (!n) {
      setError("Введите корректный номер: 9 цифр (или +992XXXXXXXXX).");
      return;
    }
    setIsSubmitting(true);
    try {
      const response = await requestPhoneLink(token, n);
      setOtpSessionId(response.otpSessionId);
      setCodeLength(response.codeLength);
      setStep("code");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось отправить код.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function onVerify() {
    setError(null);
    if (code.length < codeLength) {
      setError(`Введите ${codeLength}-значный код.`);
      return;
    }
    setIsSubmitting(true);
    try {
      await verifyPhoneLink(token, otpSessionId, code);
      const n = normalizedPhone() ?? "";
      onSuccess(n);
      close();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось подтвердить код.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-on-surface/50 flex items-center justify-center p-4" onClick={close}>
      <div className="stitch-card w-full max-w-sm p-5 space-y-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold">Привязка номера</h3>
          <button type="button" onClick={close} className="rounded-xl bg-surface-container-low p-1.5 hover:bg-surface-container-high" aria-label="Закрыть">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        {step === "phone" ? (
          <div className="space-y-3">
            <p className="text-sm text-on-surface-variant">
              Введите номер — мы отправим SMS с кодом подтверждения.
            </p>
            <div className="flex items-stretch rounded-xl border border-surface-container-high bg-surface-container-lowest overflow-hidden focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20">
              <span className="px-3 flex items-center bg-surface-container-low text-sm font-mono text-on-surface-variant">+992</span>
              <input
                type="tel"
                inputMode="numeric"
                placeholder="900100001"
                value={phone}
                onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 12))}
                className="flex-1 px-3 py-2.5 text-sm outline-none bg-transparent font-mono"
                autoFocus
              />
            </div>
            {error ? <p className="text-xs text-red-600">{error}</p> : null}
            <button type="button" className="stitch-button w-full" onClick={onSendCode} disabled={isSubmitting}>
              {isSubmitting ? "Отправляем..." : "Получить код"}
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-on-surface-variant">
              Код отправлен на <span className="font-mono font-semibold">+992{normalizedPhone() ?? ""}</span>.
            </p>
            <input
              type="text"
              inputMode="numeric"
              placeholder={"•".repeat(codeLength)}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, codeLength))}
              className="stitch-input text-center text-lg tracking-[0.5em] font-mono"
              autoFocus
            />
            {error ? <p className="text-xs text-red-600">{error}</p> : null}
            <div className="flex gap-2">
              <button type="button" className="stitch-button-secondary flex-1" onClick={() => { setStep("phone"); setError(null); }} disabled={isSubmitting}>
                Назад
              </button>
              <button type="button" className="stitch-button flex-1" onClick={onVerify} disabled={isSubmitting || code.length < codeLength}>
                {isSubmitting ? "Проверяем..." : "Подтвердить"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
