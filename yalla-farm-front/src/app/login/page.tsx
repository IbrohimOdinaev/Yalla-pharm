"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, useState, useEffect, useRef, Suspense } from "react";
import { apiFetch } from "@/shared/api/http-client";
import { formatPhone } from "@/shared/lib/format";
import { consumeGuestCheckoutIntent } from "@/shared/lib/guest-intent";
import { useAppDispatch } from "@/shared/lib/redux";
import { setCredentials } from "@/features/auth/model/authSlice";
import { AppShell } from "@/widgets/layout/AppShell";
import { TopBar } from "@/widgets/layout/TopBar";

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
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      const response = await apiFetch<{
        accessToken: string;
        role: string | number;
        userId: string;
      }>("/api/auth/login", {
        method: "POST",
        body: {
          phoneNumber: formatPhone(phoneNumber),
          password
        }
      });

      // Backend may return role as number (0=Client, 1=Admin, 2=SuperAdmin) or string
      const ROLE_MAP: Record<number, string> = { 0: "Client", 1: "Admin", 2: "SuperAdmin" };
      const role = typeof response.role === "number" ? (ROLE_MAP[response.role] ?? "Client") : String(response.role);

      dispatch(
        setCredentials({
          token: response.accessToken,
          role,
          userId: response.userId
        })
      );

      const hadCheckoutIntent = consumeGuestCheckoutIntent();
      if (redirectTo) {
        router.push(redirectTo);
      } else if (hadCheckoutIntent) {
        router.push("/checkout");
      } else if (role === "Admin") {
        router.push("/workspace");
      } else if (role === "SuperAdmin") {
        router.push("/superadmin");
      } else {
        router.push("/");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось войти.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AppShell top={<TopBar title="Вход" backHref="back" />}>
      <div className="mx-auto max-w-md px-3 xs:px-4">
        <form className="stitch-card space-y-2 xs:space-y-3 sm:space-y-4 p-3 xs:p-4 sm:p-5" onSubmit={onSubmit}>
          <h2 className="text-lg xs:text-xl sm:text-2xl font-bold">Войти в Yalla Farm</h2>

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
              <input
                className="stitch-input w-full pr-10"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
              />
              <button type="button" tabIndex={-1} className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-on-surface-variant hover:text-on-surface transition" onClick={() => setShowPassword(!showPassword)}>
                {showPassword ? (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                ) : (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                )}
              </button>
            </div>
          </label>

          {error ? <div className="rounded-xl bg-red-100 p-3 text-sm text-red-700">{error}</div> : null}

          <button type="submit" className="stitch-button w-full min-h-[44px]" disabled={isSubmitting}>
            {isSubmitting ? "Входим..." : "Войти"}
          </button>

          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-outline-variant" />
            <span className="text-xs text-on-surface-variant">или</span>
            <div className="flex-1 h-px bg-outline-variant" />
          </div>

          <TelegramLoginButton
            onAuth={async (tgUser) => {
              setIsSubmitting(true);
              setError(null);
              try {
                const response = await apiFetch<{ accessToken: string; role: string | number; userId: string }>("/api/auth/telegram", {
                  method: "POST",
                  body: {
                    id: tgUser.id,
                    firstName: tgUser.first_name,
                    lastName: tgUser.last_name ?? null,
                    username: tgUser.username ?? null,
                    photoUrl: tgUser.photo_url ?? null,
                    authDate: tgUser.auth_date,
                    hash: tgUser.hash,
                  },
                });
                const ROLE_MAP: Record<number, string> = { 0: "Client", 1: "Admin", 2: "SuperAdmin" };
                const role = typeof response.role === "number" ? (ROLE_MAP[response.role] ?? "Client") : String(response.role);
                dispatch(setCredentials({ token: response.accessToken, role, userId: response.userId }));
                const hadCheckoutIntent = consumeGuestCheckoutIntent();
                if (redirectTo) router.push(redirectTo);
                else if (hadCheckoutIntent) router.push("/checkout");
                else if (role === "Admin") router.push("/workspace");
                else if (role === "SuperAdmin") router.push("/superadmin");
                else router.push("/");
              } catch (err) {
                setError(err instanceof Error ? err.message : "Не удалось войти через Telegram.");
              } finally {
                setIsSubmitting(false);
              }
            }}
          />

          <p className="text-xs xs:text-sm text-on-surface-variant">
            Нет аккаунта? <Link href="/register" className="font-bold text-primary">Зарегистрироваться</Link>
          </p>
        </form>
      </div>
    </AppShell>
  );
}

type TgUser = { id: number; first_name: string; last_name?: string; username?: string; photo_url?: string; auth_date: number; hash: string };

function TelegramLoginButton({ onAuth }: { onAuth: (user: TgUser) => void }) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    (window as unknown as Record<string, unknown>).onTelegramAuth = (user: TgUser) => onAuth(user);

    const script = document.createElement("script");
    script.src = "https://telegram.org/js/telegram-widget.js?22";
    script.async = true;
    script.setAttribute("data-telegram-login", "yallapharm_bot");
    script.setAttribute("data-size", "large");
    script.setAttribute("data-radius", "8");
    script.setAttribute("data-onauth", "onTelegramAuth(user)");
    script.setAttribute("data-request-access", "write");
    container.appendChild(script);

    return () => {
      delete (window as unknown as Record<string, unknown>).onTelegramAuth;
      container.innerHTML = "";
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <div ref={containerRef} className="flex justify-center" />;
}
