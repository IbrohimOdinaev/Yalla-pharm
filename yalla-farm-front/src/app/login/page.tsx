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
  pollTelegramAuth,
  type RequestClientOtpResponse,
  type StartTelegramAuthResponse,
} from "@/entities/auth/api";
import { connectTelegramAuthHub } from "@/shared/lib/telegramAuthHub";
import { consumeGuestCheckoutIntent } from "@/shared/lib/guest-intent";
import { useAppDispatch } from "@/shared/lib/redux";
import { setCredentials } from "@/features/auth/model/authSlice";
import { AppShell } from "@/widgets/layout/AppShell";
import { TopBar } from "@/widgets/layout/TopBar";
import { Button, Icon, Input, Chip } from "@/shared/ui";

const ROLE_MAP: Record<number, string> = { 0: "Client", 1: "Admin", 2: "SuperAdmin" };

export default function LoginPage() {
  return (
    <Suspense fallback={<AppShell hideFooter top={<TopBar title="Вход" backHref="back" />}><div className="stitch-card p-6 text-sm">Загрузка...</div></AppShell>}>
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
        ? "Код отправлен. Это первый вход — после кода нужно будет указать имя."
        : "Код отправлен на ваш номер.");
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

  const [tgSession, setTgSession] = useState<StartTelegramAuthResponse | null>(null);
  const [tgWaiting, setTgWaiting] = useState(false);
  const tgConnectionRef = useRef<{ stop: () => Promise<void> } | null>(null);
  const tgCompletedRef = useRef(false);

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

      // SignalR is a fast-path optimisation only. Mobile browsers often drop
      // the WebSocket (1006) when the user leaves the tab for the Telegram
      // app — we must not surface that as an error. The polling effect
      // below is the reliable source of truth.
      connectTelegramAuthHub(session.nonce, {
        onConfirmed: () => onTelegramConfirmed(session.nonce),
        onCancelled: () => {
          setError("Вход отменён в Telegram.");
          closeTgModal();
        },
      })
        .then((conn) => { tgConnectionRef.current = conn; })
        .catch(() => { /* swallow — polling covers it */ });

      const a = document.createElement("a");
      a.href = session.deepLink;
      a.rel = "noopener noreferrer";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось запустить вход через Telegram.");
      closeTgModal();
    } finally {
      setIsSubmitting(false);
    }
  }

  // Reliable fallback for mobile: poll the backend until Telegram confirms
  // the nonce. Also re-checks immediately when the user returns to the tab
  // (after tapping through the Telegram app).
  useEffect(() => {
    if (!tgSession) return;
    const nonce = tgSession.nonce;
    let cancelled = false;

    async function tick() {
      if (cancelled || tgCompletedRef.current) return;
      try {
        const { status } = await pollTelegramAuth(nonce);
        if (cancelled || tgCompletedRef.current) return;
        if (status === "confirmed") {
          onTelegramConfirmed(nonce);
        } else if (status === "cancelled") {
          setError("Вход отменён в Telegram.");
          closeTgModal();
        } else if (status === "expired") {
          setError("Сессия входа истекла. Попробуйте ещё раз.");
          closeTgModal();
        }
        // "pending" / "consumed" → keep waiting silently.
      } catch {
        /* transient network error — try again next tick */
      }
    }

    tick();
    const interval = setInterval(tick, 2500);
    function onVisibility() {
      if (document.visibilityState === "visible") tick();
    }
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      cancelled = true;
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibility);
    };
    // `onTelegramConfirmed` / `closeTgModal` are safe to reference via closure:
    // they dedupe through `tgCompletedRef` and operate on stable setters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tgSession]);

  return (
    <AppShell hideFooter top={<TopBar title="Вход" backHref="back" />}>
      <div className="mx-auto max-w-md">
        {/* Hero illustration */}
        <div className="mb-6 flex flex-col items-center gap-4 pt-2">
          <div className="relative flex h-28 w-28 items-center justify-center">
            <span className="absolute inset-0 rounded-full bg-primary/10" />
            <span className="absolute -right-2 -top-2 h-6 w-6 rounded-full bg-accent-coral" />
            <span className="absolute -left-3 bottom-0 h-4 w-4 rounded-full bg-accent-sky" />
            <span className="absolute right-1 bottom-2 h-3 w-3 rounded-full bg-accent-sun" />
            <span className="flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-primary to-primary-container text-white shadow-glass">
              <Icon name="pharmacy" size={40} />
            </span>
          </div>
          <div className="text-center">
            <h1 className="font-display text-2xl font-extrabold text-on-surface">
              {session ? "Подтверждение" : "Добро пожаловать"}
            </h1>
            <p className="mt-1 text-sm text-on-surface-variant">
              {session
                ? <>Код отправлен на <span className="font-bold text-on-surface">+992 {phoneNumber}</span></>
                : "Введите номер телефона, чтобы войти или создать аккаунт"}
            </p>
          </div>
        </div>

        {!session ? (
          <form className="space-y-5 rounded-3xl bg-surface-container-lowest p-5 shadow-card" onSubmit={onRequestOtp}>
            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold text-on-surface-variant">
                Номер телефона
              </span>
              <div className="flex items-center gap-2 rounded-2xl bg-surface-container-low px-3.5 focus-within:ring-2 focus-within:ring-primary/30">
                <span className="text-base">🇹🇯</span>
                <span className="font-semibold text-on-surface-variant">+992</span>
                <input
                  className="min-w-0 flex-1 bg-transparent py-3.5 text-lg font-semibold tracking-wider text-on-surface placeholder:text-on-surface-variant/50 outline-none tabular-nums"
                  type="tel"
                  inputMode="numeric"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value.replace(/\D/g, "").slice(0, 9))}
                  placeholder="93 •••• •• ••"
                  required
                />
              </div>
              <span className="mt-1.5 block text-[11px] text-on-surface-variant/80">
                Мы отправим SMS с кодом подтверждения
              </span>
            </label>

            {error ? (
              <div className="rounded-2xl bg-secondary/10 p-3 text-sm font-semibold text-secondary">{error}</div>
            ) : null}

            <Button type="submit" size="lg" fullWidth rightIcon="arrow-right" loading={isSubmitting}>
              Получить код
            </Button>

            <div className="flex items-center gap-3">
              <span className="h-px flex-1 bg-surface-container-high" />
              <span className="text-xs font-semibold text-on-surface-variant">или</span>
              <span className="h-px flex-1 bg-surface-container-high" />
            </div>

            <Button
              type="button"
              variant="telegram"
              size="lg"
              fullWidth
              leftIcon="telegram"
              onClick={onTelegramLoginClick}
              disabled={isSubmitting}
            >
              Войти через Telegram
            </Button>

            <div className="flex flex-wrap gap-1.5 justify-center pt-1">
              <Chip tone="primary" leftIcon="bolt" asButton={false}>Быстрая регистрация</Chip>
              <Chip tone="tertiary" leftIcon="eye" asButton={false}>Безопасно</Chip>
            </div>

            <p className="pt-2 text-center text-[11px] text-on-surface-variant/80">
              Продолжая, вы принимаете условия сервиса
            </p>
          </form>
        ) : (
          <form className="space-y-5 rounded-3xl bg-surface-container-lowest p-5 shadow-card" onSubmit={onVerifyOtp}>
            <label className="block">
              <span className="mb-2 block text-xs font-semibold text-on-surface-variant">
                Код из SMS · {session.codeLength} цифр
              </span>
              <input
                ref={codeInputRef}
                className="w-full rounded-2xl bg-surface-container-low py-4 text-center font-mono text-3xl tracking-[0.5em] font-bold text-on-surface outline-none focus:ring-2 focus:ring-primary/30"
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
              <Input
                label="Ваше имя"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Как к вам обращаться"
                maxLength={64}
                required
              />
            ) : null}

            {error ? (
              <div className="rounded-2xl bg-secondary/10 p-3 text-sm font-semibold text-secondary">{error}</div>
            ) : null}
            {info ? (
              <div className="rounded-2xl bg-accent-mint p-3 text-sm font-semibold text-primary">{info}</div>
            ) : null}

            <Button type="submit" size="lg" fullWidth loading={isSubmitting}>
              Войти
            </Button>

            <div className="flex gap-2">
              <Button
                type="button"
                variant="secondary"
                size="md"
                fullWidth
                onClick={onChangeNumber}
              >
                Изменить номер
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="md"
                fullWidth
                onClick={onResend}
                disabled={isSubmitting || resendSecondsLeft > 0}
              >
                {resendSecondsLeft > 0 ? `Повторно · ${resendSecondsLeft} с` : "Отправить повторно"}
              </Button>
            </div>
          </form>
        )}

        <p className="mt-6 text-center text-xs text-on-surface-variant">
          Сотрудник аптеки?{" "}
          <Link href="/login/admin" className="font-bold text-primary hover:underline">
            Вход для администратора →
          </Link>
        </p>
      </div>

      {tgWaiting && tgSession ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-3">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={closeTgModal} />
          <div
            className="relative w-full max-w-sm rounded-3xl bg-surface-container-lowest p-6 shadow-glass space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-telegram-soft text-telegram">
              <Icon name="telegram" size={32} />
            </div>
            <div className="text-center space-y-1.5">
              <h3 className="font-display text-lg font-extrabold">Подтвердите вход в Telegram</h3>
              <p className="text-sm text-on-surface-variant">
                Откройте бот{" "}
                <span className="font-mono font-bold text-on-surface">@{tgSession.botUsername}</span>{" "}
                и нажмите «Подтвердить».
              </p>
            </div>

            <Button
              variant="telegram"
              size="lg"
              fullWidth
              leftIcon="telegram"
              onClick={() => { window.location.href = tgSession.deepLink; }}
            >
              Открыть Telegram
            </Button>

            <Button variant="secondary" size="md" fullWidth onClick={closeTgModal}>
              Отмена
            </Button>

            <p className="text-center text-[11px] text-on-surface-variant/80">
              Сессия истекает через {tgSession.ttlSeconds} сек.
            </p>
          </div>
        </div>
      ) : null}
    </AppShell>
  );
}
