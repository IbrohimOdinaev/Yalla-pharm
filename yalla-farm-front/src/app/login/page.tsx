"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { apiFetch } from "@/shared/api/http-client";
import { formatPhone } from "@/shared/lib/format";
import { consumeGuestCheckoutIntent } from "@/shared/lib/guest-intent";
import { useAppDispatch } from "@/shared/lib/redux";
import { setCredentials } from "@/features/auth/model/authSlice";
import { AppShell } from "@/widgets/layout/AppShell";
import { TopBar } from "@/widgets/layout/TopBar";

export default function LoginPage() {
  const router = useRouter();
  const dispatch = useAppDispatch();

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
      if (hadCheckoutIntent) {
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
    <AppShell top={<TopBar title="Вход" backHref="/" />}>
      <div className="mx-auto max-w-md">
        <form className="stitch-card space-y-4 p-6" onSubmit={onSubmit}>
          <h2 className="text-xl font-bold">Войти в Yalla Farm</h2>

          <label className="block space-y-1">
            <span className="text-sm font-medium text-on-surface-variant">Телефон</span>
            <input
              className="stitch-input"
              type="tel"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              placeholder="900123456"
              required
            />
          </label>

          <label className="block space-y-1">
            <span className="text-sm font-medium text-on-surface-variant">Пароль</span>
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

          <button type="submit" className="stitch-button w-full" disabled={isSubmitting}>
            {isSubmitting ? "Входим..." : "Войти"}
          </button>

          <p className="text-sm text-on-surface-variant">
            Нет аккаунта? <Link href="/register" className="font-bold text-primary">Зарегистрироваться</Link>
          </p>
        </form>
      </div>
    </AppShell>
  );
}
