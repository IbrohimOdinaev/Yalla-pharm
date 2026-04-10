"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, useEffect, useRef, useState, Suspense, useCallback } from "react";
import {
  requestClientOtp,
  verifyClientOtp,
  resendClientOtp,
  startTelegramAuth,
  completeTelegramAuth,
  type RequestClientOtpResponse,
  type StartTelegramAuthResponse,
} from "@/entities/auth/api";
import { connectTelegramAuthHub } from "@/shared/lib/telegramAuthHub";
import { consumeGuestCheckoutIntent } from "@/shared/lib/guest-intent";
import { useAppDispatch } from "@/shared/lib/redux";
import { setCredentials } from "@/features/auth/model/authSlice";
import { AppShell } from "@/widgets/layout/AppShell";
import { TopBar } from "@/widgets/layout/TopBar";

const ROLE_MAP: Record<number, string> = { 0: "Client", 1: "Admin", 2: "SuperAdmin" };

export default function LoginPage() {
  return (
    <Suspense fallback={<AppShell top={<TopBar title="Вход" backHref="back" />}><div className="stitch-card p-6 text-sm">Загрузка...</div></AppShell>}>
      <LoginContent />
    </Suspense>
  );
}

function LoginContent() {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirect");

  const [phoneNumber, setPhoneNumber] = useState("");
  const [session, setSession] = useState<RequestClientOtpResponse | null>(null);
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [resendSecondsLeft, setResendSecondsLeft] = useState(0);
  const codeInputRef = useRef<HTMLInputElement>(null);

  // Countdown to next available resend
  useEffect(() => {
    if (!session) { setResendSecondsLeft(0); return; }
    const update = () => {
      const diff = Math.max(0, Math.ceil((new Date(session.resendAvailableAtUtc).getTime() - Date.now()) / 1000));
      setResendSecondsLeft(diff);
    };
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [session]);

  useEffect(() => {
    if (session) setTimeout(() => codeInputRef.current?.focus(), 50);
  }, [session]);

  function applyCredentialsAndRedirect(token: string, role: string, userId: string) {
    dispatch(setCredentials({ token, role, userId }));
    const hadCheckoutIntent = consumeGuestCheckoutIntent();
    if (redirectTo) router.push(redirectTo);
    else if (hadCheckoutIntent) router.push("/checkout");
    else router.push("/");
  }

  async function onRequestOtp(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    if (phoneNumber.length !== 9) {
      setError("Введите 9 цифр номера телефона.");
      return;
    }
    setIsSubmitting(true);
    try {
      const resp = await requestClientOtp(phoneNumber);
      setSession(resp);
      setInfo(resp.isNewClient
        ? "На ваш номер отправлен код подтверждения. Это первый вход — после кода нужно будет указать имя."
        : "На ваш номер отправлен код подтверждения.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось отправить код.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function onVerifyOtp(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!session) return;
    setError(null);
    setInfo(null);
    if (code.length !== session.codeLength) {
      setError(`Введите код из ${session.codeLength} цифр.`);
      return;
    }
    if (session.isNewClient && !name.trim()) {
      setError("Введите ваше имя.");
      return;
    }
    setIsSubmitting(true);
    try {
      const resp = await verifyClientOtp(session.otpSessionId, code, session.isNewClient ? name.trim() : undefined);
      const role = typeof resp.role === "number" ? (ROLE_MAP[resp.role] ?? "Client") : String(resp.role);
      applyCredentialsAndRedirect(resp.accessToken, role, resp.userId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Неверный код подтверждения.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function onResend() {
    if (!session || resendSecondsLeft > 0) return;
    setError(null);
    setInfo(null);
    setIsSubmitting(true);
    try {
      const resp = await resendClientOtp(session.otpSessionId);
      setSession(resp);
      setInfo("Код отправлен повторно.");
      setCode("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось переотправить код.");
    } finally {
      setIsSubmitting(false);
    }
  }

  function onChangeNumber() {
    setSession(null);
    setCode("");
    setName("");
    setError(null);
    setInfo(null);
  }

  // ───────── Telegram bot deeplink auth ─────────
  const [tgSession, setTgSession] = useState<StartTelegramAuthResponse | null>(null);
  const [tgWaiting, setTgWaiting] = useState(false);
  const tgConnectionRef = useRef<{ stop: () => Promise<void> } | null>(null);
  const tgCompletedRef = useRef(false);

  // Cleanup hub connection on unmount
  useEffect(() => {
    return () => {
      tgConnectionRef.current?.stop().catch(() => undefined);
    };
  }, []);

  const closeTgModal = useCallback(() => {
    tgConnectionRef.current?.stop().catch(() => undefined);
    tgConnectionRef.current = null;
    setTgSession(null);
    setTgWaiting(false);
    tgCompletedRef.current = false;
  }, []);

  async function onTelegramConfirmed(nonce: string) {
    if (tgCompletedRef.current) return;
    tgCompletedRef.current = true;
    try {
      const resp = await completeTelegramAuth(nonce);
      const role = typeof resp.role === "number" ? (ROLE_MAP[resp.role] ?? "Client") : String(resp.role);
      applyCredentialsAndRedirect(resp.accessToken, role, resp.userId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось завершить вход через Telegram.");
      closeTgModal();
    }
  }

  async function onTelegramLoginClick() {
    setError(null);
    setInfo(null);
    setIsSubmitting(true);
    try {
      const session = await startTelegramAuth();
      setTgSession(session);
      setTgWaiting(true);

      // Trigger the tg:// protocol handler to open the Telegram app.
      // We use an anchor click instead of window.open so the browser doesn't
      // open a blank tab if the protocol handler fails.
      const a = document.createElement("a");
      a.href = session.deepLink;
      a.rel = "noopener noreferrer";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);

      // Subscribe to real-time confirmation event
      const conn = await connectTelegramAuthHub(session.nonce, {
        onConfirmed: () => onTelegramConfirmed(session.nonce),
        onCancelled: () => {
          setError("Вход отменён в Telegram.");
          closeTgModal();
        },
      });
      tgConnectionRef.current = conn;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось запустить вход через Telegram.");
      closeTgModal();
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AppShell top={<TopBar title="Вход" backHref="back" />}>
      <div className="mx-auto max-w-md px-3 xs:px-4">
        {!session ? (
          <form className="stitch-card space-y-3 sm:space-y-4 p-3 xs:p-4 sm:p-5" onSubmit={onRequestOtp}>
            <h2 className="text-lg xs:text-xl sm:text-2xl font-bold">Вход в Yalla Farm</h2>
            <p className="text-xs xs:text-sm text-on-surface-variant">
              Введите номер телефона, и мы отправим вам код подтверждения по SMS.
            </p>

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

            {error ? <div className="rounded-xl bg-red-100 p-3 text-sm text-red-700">{error}</div> : null}

            <button type="submit" className="stitch-button w-full min-h-[44px]" disabled={isSubmitting}>
              {isSubmitting ? "Отправляем..." : "Получить код"}
            </button>

            <div className="flex items-center gap-3">
              <div className="flex-1 h-px bg-outline-variant" />
              <span className="text-xs text-on-surface-variant">или</span>
              <div className="flex-1 h-px bg-outline-variant" />
            </div>

            <button
              type="button"
              onClick={onTelegramLoginClick}
              disabled={isSubmitting}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#229ED9] px-4 py-3 text-sm font-bold text-white transition hover:bg-[#1c8cc4] disabled:cursor-not-allowed disabled:opacity-50 min-h-[44px]"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.894 8.221l-1.97 9.28c-.145.658-.537.818-1.084.508l-3-2.21-1.446 1.394c-.16.16-.295.295-.605.295l.213-3.053 5.56-5.022c.242-.213-.054-.334-.373-.121l-6.871 4.326-2.96-.924c-.643-.204-.66-.643.136-.953l11.566-4.458c.534-.197 1.002.13.834.938z"/>
              </svg>
              Войти через Telegram
            </button>

            <p className="text-[10px] xs:text-xs text-center text-on-surface-variant pt-2">
              <Link href="/login/admin" className="font-semibold text-on-surface-variant hover:text-primary transition">
                Вход для администратора
              </Link>
            </p>
          </form>
        ) : (
          <form className="stitch-card space-y-3 sm:space-y-4 p-3 xs:p-4 sm:p-5" onSubmit={onVerifyOtp}>
            <h2 className="text-lg xs:text-xl sm:text-2xl font-bold">Подтверждение</h2>
            <p className="text-xs xs:text-sm text-on-surface-variant">
              Код отправлен на <span className="font-bold text-on-surface">+992 {phoneNumber}</span>.{" "}
              <button type="button" className="font-bold text-primary hover:underline" onClick={onChangeNumber}>
                Изменить
              </button>
            </p>

            <label className="block space-y-1">
              <span className="text-xs xs:text-sm font-medium text-on-surface-variant">
                Код из SMS ({session.codeLength} цифр)
              </span>
              <input
                ref={codeInputRef}
                className="stitch-input text-center text-2xl tracking-[0.4em] font-mono"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, session.codeLength))}
                placeholder={"•".repeat(session.codeLength)}
                required
              />
            </label>

            {session.isNewClient ? (
              <label className="block space-y-1">
                <span className="text-xs xs:text-sm font-medium text-on-surface-variant">Ваше имя</span>
                <input
                  className="stitch-input"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Как к вам обращаться"
                  maxLength={64}
                  required
                />
              </label>
            ) : null}

            {error ? <div className="rounded-xl bg-red-100 p-3 text-sm text-red-700">{error}</div> : null}
            {info ? <div className="rounded-xl bg-emerald-100 p-3 text-sm text-emerald-700">{info}</div> : null}

            <button type="submit" className="stitch-button w-full min-h-[44px]" disabled={isSubmitting}>
              {isSubmitting ? "Проверяем..." : "Войти"}
            </button>

            <button
              type="button"
              className="stitch-button-secondary w-full text-sm"
              onClick={onResend}
              disabled={isSubmitting || resendSecondsLeft > 0}
            >
              {resendSecondsLeft > 0
                ? `Отправить код повторно через ${resendSecondsLeft} сек.`
                : "Отправить код повторно"}
            </button>
          </form>
        )}
      </div>

      {tgWaiting && tgSession ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-3">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={closeTgModal} />
          <div
            className="relative w-full max-w-sm rounded-2xl bg-surface-container-lowest p-5 sm:p-6 shadow-2xl space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-center w-14 h-14 mx-auto rounded-full bg-[#229ED9]/10 text-[#229ED9]">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.894 8.221l-1.97 9.28c-.145.658-.537.818-1.084.508l-3-2.21-1.446 1.394c-.16.16-.295.295-.605.295l.213-3.053 5.56-5.022c.242-.213-.054-.334-.373-.121l-6.871 4.326-2.96-.924c-.643-.204-.66-.643.136-.953l11.566-4.458c.534-.197 1.002.13.834.938z"/>
              </svg>
            </div>
            <div className="text-center space-y-1.5">
              <h3 className="text-base sm:text-lg font-bold">Подтвердите вход в Telegram</h3>
              <p className="text-xs sm:text-sm text-on-surface-variant">
                Откройте бот <span className="font-mono font-bold text-on-surface">@{tgSession.botUsername}</span>{" "}
                и нажмите «Подтвердить». После этого вы автоматически вернётесь в свой аккаунт.
              </p>
            </div>

            <a
              href={tgSession.deepLink}
              rel="noopener noreferrer"
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#229ED9] px-4 py-3 text-sm font-bold text-white transition hover:bg-[#1c8cc4]"
            >
              Открыть Telegram
            </a>

            <button
              type="button"
              onClick={closeTgModal}
              className="stitch-button-secondary w-full text-sm"
            >
              Отмена
            </button>

            <p className="text-[10px] text-center text-on-surface-variant">
              Сессия истекает через {tgSession.ttlSeconds} сек.
            </p>
          </div>
        </div>
      ) : null}
    </AppShell>
  );
}
