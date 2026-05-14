"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, Suspense, useState } from "react";
import { adminLogin, superAdminLogin, pharmacistLogin } from "@/entities/auth/api";
import { formatPhone } from "@/shared/lib/format";
import { useAppDispatch } from "@/shared/lib/redux";
import { setCredentials } from "@/features/auth/model/authSlice";
import { decodeJwt } from "@/shared/lib/jwt";
import { ApiError } from "@/shared/api/http-client";
import { AppShell } from "@/widgets/layout/AppShell";
import { TopBar } from "@/widgets/layout/TopBar";
import { Button, Icon, IconButton } from "@/shared/ui";

// Translates auth/login errors into actionable user-facing strings. The raw
// backend message ("Request Failed. Операция не может быть выполнена…")
// is technically correct but useless to a person trying to log in.
function loginErrorMessage(err: unknown): string {
  if (err instanceof ApiError) {
    // Wrong credentials: backend returns 400 invalid_operation or 401.
    if (err.status === 401 || err.status === 400) {
      return "Неправильный номер или пароль.";
    }
    if (err.status === 429) {
      return "Слишком много попыток входа. Попробуйте через несколько минут.";
    }
    if (err.status === 404) {
      return "Аккаунт не найден. Проверьте номер телефона.";
    }
    if (err.status >= 500) {
      return "Сервер временно недоступен. Попробуйте позже.";
    }
    // Fall through to backend message for any other 4xx.
    return err.message || "Не удалось войти. Попробуйте ещё раз.";
  }
  // Network errors thrown by fetch don't have a status — surface a clear hint.
  if (err instanceof TypeError && /fetch/i.test(err.message)) {
    return "Не удалось связаться с сервером. Проверьте интернет-соединение.";
  }
  if (err instanceof Error && err.message) return err.message;
  return "Не удалось войти. Попробуйте ещё раз.";
}

const ROLE_MAP: Record<number, string> = { 0: "Client", 1: "Admin", 2: "SuperAdmin", 3: "Pharmacist" };

// Single staff-login form. One phone number can only belong to one staff
// role, so we no longer ask the user to pick — instead we probe each
// role-specific endpoint in sequence and accept whichever succeeds. Wrong
// password / non-existent account → every endpoint returns 4xx and we
// surface the standard "wrong number or password" message.
async function tryStaffLogin(phone: string, password: string) {
  const attempts = [adminLogin, superAdminLogin, pharmacistLogin];
  let lastErr: unknown;
  for (const attempt of attempts) {
    try {
      return await attempt(phone, password);
    } catch (err) {
      lastErr = err;
      // Try the next role only on credential-style failures (401/404).
      // Real outages (5xx, 429, network) propagate immediately.
      if (err instanceof ApiError) {
        if (err.status === 401 || err.status === 404 || err.status === 400) continue;
      }
      throw err;
    }
  }
  throw lastErr;
}

export default function AdminLoginPage() {
  return (
    <Suspense fallback={<AppShell hideFooter top={<TopBar title="Вход для персонала" backHref="back" />}><div className="stitch-card p-6 text-sm">Загрузка...</div></AppShell>}>
      <AdminLoginContent />
    </Suspense>
  );
}

function AdminLoginContent() {
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
      const normalizedPhone = formatPhone(phoneNumber);
      const response = await tryStaffLogin(normalizedPhone, password);

      const role = typeof response.role === "number"
        ? (ROLE_MAP[response.role] ?? "Client")
        : String(response.role);

      // Pull pharmacy_id from the JWT — admin tokens always carry it.
      const claims = decodeJwt(response.accessToken);
      dispatch(setCredentials({
        token: response.accessToken,
        role,
        userId: response.userId,
        pharmacyId: claims.pharmacyId,
      }));

      if (redirectTo) router.push(redirectTo);
      else if (role === "Admin") router.push("/workspace");
      else if (role === "SuperAdmin") router.push("/superadmin");
      else if (role === "Pharmacist") router.push("/pharmacist");
      else router.push("/");
    } catch (err) {
      setError(loginErrorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AppShell hideFooter top={<TopBar title="Вход для персонала" backHref="back" />}>
      <div className="mx-auto max-w-md">
        <div className="mb-6 flex flex-col items-center gap-3 pt-2 text-center">
          <span className="flex h-16 w-16 items-center justify-center rounded-3xl bg-gradient-to-br from-primary to-primary-container text-white shadow-card">
            <Icon name="settings" size={30} />
          </span>
          <h1 className="font-display text-2xl font-extrabold">Кабинет персонала</h1>
          <p className="max-w-xs text-sm text-on-surface-variant">
            Клиенты входят через{" "}
            <Link href="/login" className="font-bold text-primary hover:underline">
              SMS-код
            </Link>
            . Для доступа к кабинету используйте пароль.
          </p>
        </div>

        <form
          className="space-y-4 rounded-3xl bg-surface-container-lowest p-5 shadow-card"
          onSubmit={onSubmit}
        >
          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold text-on-surface-variant">
              Номер телефона
            </span>
            <div className="flex items-center gap-2 rounded-2xl bg-surface-container-low px-3.5 focus-within:ring-2 focus-within:ring-primary/30">
              <span className="text-sm">🇹🇯</span>
              <span className="font-semibold text-on-surface-variant">+992</span>
              <input
                className="min-w-0 flex-1 bg-transparent py-3 text-base font-semibold tracking-wider text-on-surface outline-none tabular-nums"
                type="tel"
                inputMode="numeric"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value.replace(/\D/g, "").slice(0, 9))}
                placeholder="93 •••• •• ••"
                required
              />
            </div>
          </label>

          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold text-on-surface-variant">
              Пароль
            </span>
            <div className="flex items-center gap-2 rounded-2xl bg-surface-container-low px-3.5 focus-within:ring-2 focus-within:ring-primary/30">
              <input
                className="min-w-0 flex-1 bg-transparent py-3 text-sm text-on-surface outline-none"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
              />
              <IconButton
                icon={showPassword ? "eye-off" : "eye"}
                variant="ghost"
                size="sm"
                onClick={() => setShowPassword(!showPassword)}
                aria-label="Показать пароль"
                type="button"
                tabIndex={-1}
              />
            </div>
          </label>

          {error ? (
            <div className="rounded-2xl bg-secondary/10 p-3 text-sm font-semibold text-secondary">
              {error}
            </div>
          ) : null}

          <Button type="submit" size="lg" fullWidth rightIcon="arrow-right" loading={isSubmitting}>
            Войти
          </Button>
        </form>
      </div>
    </AppShell>
  );
}
