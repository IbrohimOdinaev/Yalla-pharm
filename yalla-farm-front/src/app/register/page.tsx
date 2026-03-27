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

export default function RegisterPage() {
  const [name, setName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [password, setPassword] = useState("");
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
    setIsSubmitting(true);

    try {
      if (!verifyBySms) {
        await apiFetch("/api/clients/register", {
          method: "POST",
          body: {
            name,
            phoneNumber: normalizedPhone,
            password,
            skipPhoneVerification: true
          }
        });

        setMessage("Аккаунт создан без SMS-подтверждения. Теперь можно войти.");
        return;
      }

      const response = await apiFetch<RegistrationSession>("/api/clients/register/request", {
        method: "POST",
        body: {
          name,
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
    <AppShell top={<TopBar title="Регистрация" backHref="/" />}>
      <div className="mx-auto max-w-md space-y-4">
        <form className="stitch-card space-y-4 p-6" onSubmit={startRegistration}>
          <h2 className="text-xl font-bold">Создать аккаунт клиента</h2>

          <label className="block space-y-1">
            <span className="text-sm font-medium text-on-surface-variant">Имя</span>
            <input className="stitch-input" value={name} onChange={(e) => setName(e.target.value)} required />
          </label>

          <label className="block space-y-1">
            <span className="text-sm font-medium text-on-surface-variant">Телефон</span>
            <input className="stitch-input" value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value)} required />
          </label>

          <label className="block space-y-1">
            <span className="text-sm font-medium text-on-surface-variant">Пароль</span>
            <input className="stitch-input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </label>

          <label className="flex items-center gap-2 rounded-xl bg-surface-container-low p-3 text-sm font-medium">
            <input type="checkbox" checked={verifyBySms} onChange={(e) => setVerifyBySms(e.target.checked)} />
            Регистрация с SMS-подтверждением
          </label>

          {error ? <div className="rounded-xl bg-red-100 p-3 text-sm text-red-700">{error}</div> : null}
          {message ? <div className="rounded-xl bg-emerald-100 p-3 text-sm text-emerald-700">{message}</div> : null}

          <button type="submit" className="stitch-button w-full" disabled={isSubmitting}>
            {isSubmitting ? "Обрабатываем..." : verifyBySms ? "Получить код" : "Создать аккаунт"}
          </button>

          <p className="text-sm text-on-surface-variant">
            Уже зарегистрированы? <Link className="font-bold text-primary" href="/login">Войти</Link>
          </p>
        </form>

        {session ? (
          <form className="stitch-card space-y-4 p-6" onSubmit={verifyRegistration}>
            <h3 className="text-lg font-bold">Подтвердите номер</h3>
            <p className="text-sm text-on-surface-variant">
              Введите код из SMS для {session.phoneNumber}. Срок действия до {new Date(session.expiresAtUtc).toLocaleTimeString("ru-RU")}
            </p>

            <label className="block space-y-1">
              <span className="text-sm font-medium text-on-surface-variant">Код ({session.codeLength} символов)</span>
              <input
                className="stitch-input tracking-widest sm:tracking-[0.3em]"
                value={verificationCode}
                onChange={(e) => setVerificationCode(e.target.value)}
                maxLength={session.codeLength}
                required
              />
            </label>

            <button type="submit" className="stitch-button w-full" disabled={isSubmitting}>
              {isSubmitting ? "Проверяем..." : "Подтвердить"}
            </button>

            <button type="button" className="stitch-button-secondary w-full" onClick={resendCode} disabled={isSubmitting}>
              Отправить код повторно
            </button>
          </form>
        ) : null}
      </div>
    </AppShell>
  );
}
