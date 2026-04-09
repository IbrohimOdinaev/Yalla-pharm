"use client";

import Link from "next/link";
import React, { FormEvent, useState } from "react";
import { apiFetch } from "@/shared/api/http-client";
import { formatPhone } from "@/shared/lib/format";
import { AppShell } from "@/widgets/layout/AppShell";
import { TopBar } from "@/widgets/layout/TopBar";

type RegistrationSession = {
  registrationId: string;
  phoneNumber: string;
  expiresAtUtc: string;
  resendAvailableAtUtc: string;
  codeLength: number;
};

function EyeIcon({ open }: { open: boolean }) {
  return open ? (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
  ) : (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
  );
}

export default function RegisterPage() {
  const [phoneNumber, setPhoneNumber] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [verifyBySms, setVerifyBySms] = useState(true);
  const [verificationCode, setVerificationCode] = useState("");
  const [session, setSession] = useState<RegistrationSession | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const normalizedPhone = formatPhone(phoneNumber);

  async function startRegistration(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setMessage(null);

    if (password !== confirmPassword) {
      setError("Пароли не совпадают.");
      return;
    }
    if (password.length < 6) {
      setError("Пароль должен содержать минимум 6 символов.");
      return;
    }

    setIsSubmitting(true);

    try {
      if (!verifyBySms) {
        await apiFetch("/api/clients/register", {
          method: "POST",
          body: {
            name: "",
            phoneNumber: normalizedPhone,
            password,
            skipPhoneVerification: true
          }
        });

        setMessage("Аккаунт создан. Теперь можно войти.");
        return;
      }

      const response = await apiFetch<RegistrationSession>("/api/clients/register/request", {
        method: "POST",
        body: {
          name: "",
          phoneNumber: normalizedPhone,
          password,
          skipPhoneVerification: false
        }
      });

      setSession(response);
      setMessage("Код отправлен. Введите 6 символов для завершения регистрации.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось начать регистрацию.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function verifyRegistration(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!session) return;

    setIsSubmitting(true);
    setError(null);

    try {
      await apiFetch("/api/clients/register/verify", {
        method: "POST",
        body: {
          registrationId: session.registrationId,
          code: verificationCode
        }
      });

      setMessage("Номер подтверждён. Регистрация завершена, выполните вход.");
      setSession(null);
      setVerificationCode("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Код неверный.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function resendCode() {
    if (!session) return;

    setIsSubmitting(true);
    setError(null);

    try {
      const next = await apiFetch<RegistrationSession>("/api/clients/register/resend", {
        method: "POST",
        body: {
          registrationId: session.registrationId
        }
      });

      setSession(next);
      setMessage("Новый код отправлен.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось отправить код повторно.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AppShell top={<TopBar title="Регистрация" backHref="back" />}>
      <div className="mx-auto max-w-md px-3 xs:px-4 space-y-2 xs:space-y-3 sm:space-y-4">
        <form className="stitch-card space-y-2 xs:space-y-3 sm:space-y-4 p-3 xs:p-4 sm:p-5" onSubmit={startRegistration}>
          <h2 className="text-lg xs:text-xl sm:text-2xl font-bold">Создать аккаунт</h2>

          <label className="block space-y-1">
            <span className="text-xs xs:text-sm font-medium text-on-surface-variant">Телефон</span>
            <div className="flex items-center stitch-input p-0 overflow-hidden">
              <span className="pl-3 pr-1 text-on-surface-variant font-medium select-none flex-shrink-0">+992</span>
              <input
                className="flex-1 bg-transparent border-none outline-none py-2 pr-3 text-on-surface"
                type="tel"
                inputMode="numeric"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value.replace(/\D/g, "").slice(0, 9))}
                placeholder="900123456"
                required
              />
            </div>
          </label>

          <label className="block space-y-1">
            <span className="text-xs xs:text-sm font-medium text-on-surface-variant">Пароль</span>
            <div className="relative">
              <input className="stitch-input w-full pr-10" type={showPassword ? "text" : "password"} placeholder="Минимум 6 символов" value={password} onChange={(e) => setPassword(e.target.value)} required />
              <button type="button" tabIndex={-1} className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-on-surface-variant hover:text-on-surface transition" onClick={() => setShowPassword(!showPassword)}>
                <EyeIcon open={showPassword} />
              </button>
            </div>
          </label>

          <label className="block space-y-1">
            <span className="text-xs xs:text-sm font-medium text-on-surface-variant">Подтвердите пароль</span>
            <div className="relative">
              <input className="stitch-input w-full pr-10" type={showConfirm ? "text" : "password"} placeholder="Повторите пароль" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required />
              <button type="button" tabIndex={-1} className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-on-surface-variant hover:text-on-surface transition" onClick={() => setShowConfirm(!showConfirm)}>
                <EyeIcon open={showConfirm} />
              </button>
            </div>
          </label>

          <label className="flex items-center gap-2 rounded-xl bg-surface-container-low p-2 xs:p-3 text-xs xs:text-sm font-medium">
            <input type="checkbox" checked={verifyBySms} onChange={(e) => setVerifyBySms(e.target.checked)} />
            Регистрация с SMS-подтверждением
          </label>

          {error ? <div className="rounded-xl bg-red-100 p-3 text-sm text-red-700">{error}</div> : null}
          {message ? <div className="rounded-xl bg-emerald-100 p-3 text-sm text-emerald-700">{message}</div> : null}

          <button type="submit" className="stitch-button w-full min-h-[44px]" disabled={isSubmitting}>
            {isSubmitting ? "Обрабатываем..." : verifyBySms ? "Получить код" : "Создать аккаунт"}
          </button>

          <p className="text-xs xs:text-sm text-on-surface-variant">
            Уже зарегистрированы? <Link className="font-bold text-primary" href="/login">Войти</Link>
          </p>
        </form>

        {session ? (
          <form className="stitch-card space-y-2 xs:space-y-3 sm:space-y-4 p-3 xs:p-4 sm:p-5" onSubmit={verifyRegistration}>
            <h3 className="text-base xs:text-lg font-bold">Подтвердите номер</h3>
            <p className="text-xs xs:text-sm text-on-surface-variant">
              Введите код из SMS для {session.phoneNumber}. Срок действия до {new Date(session.expiresAtUtc).toLocaleTimeString("ru-RU")}
            </p>

            <label className="block space-y-1">
              <span className="text-xs xs:text-sm font-medium text-on-surface-variant">Код ({session.codeLength} символов)</span>
              <input
                className="stitch-input tracking-widest sm:tracking-[0.3em]"
                value={verificationCode}
                onChange={(e) => setVerificationCode(e.target.value)}
                maxLength={session.codeLength}
                required
              />
            </label>

            <button type="submit" className="stitch-button w-full min-h-[44px]" disabled={isSubmitting}>
              {isSubmitting ? "Проверяем..." : "Подтвердить"}
            </button>

            <button type="button" className="stitch-button-secondary w-full min-h-[44px]" onClick={resendCode} disabled={isSubmitting}>
              Отправить код повторно
            </button>
          </form>
        ) : null}
      </div>
    </AppShell>
  );
}
