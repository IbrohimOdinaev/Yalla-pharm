"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, Suspense, useState } from "react";
import { adminLogin, superAdminLogin } from "@/entities/auth/api";
import { formatPhone } from "@/shared/lib/format";
import { useAppDispatch } from "@/shared/lib/redux";
import { setCredentials } from "@/features/auth/model/authSlice";
import { AppShell } from "@/widgets/layout/AppShell";
import { TopBar } from "@/widgets/layout/TopBar";
import { Button, Icon, IconButton } from "@/shared/ui";

const ROLE_MAP: Record<number, string> = { 0: "Client", 1: "Admin", 2: "SuperAdmin" };
type StaffRole = "Admin" | "SuperAdmin";

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

  const [staffRole, setStaffRole] = useState<StaffRole>("Admin");
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
      const response = staffRole === "Admin"
        ? await adminLogin(normalizedPhone, password)
        : await superAdminLogin(normalizedPhone, password);

      const role = typeof response.role === "number"
        ? (ROLE_MAP[response.role] ?? staffRole)
        : String(response.role);

      dispatch(setCredentials({ token: response.accessToken, role, userId: response.userId }));

      if (redirectTo) router.push(redirectTo);
      else if (role === "Admin") router.push("/workspace");
      else if (role === "SuperAdmin") router.push("/superadmin");
      else router.push("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось войти.");
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
          {/* Role tabs */}
          <div className="flex items-center gap-1 rounded-full bg-surface-container-low p-1">
            <button
              type="button"
              onClick={() => { setStaffRole("Admin"); setError(null); }}
              className={`flex-1 rounded-full px-4 py-2 text-xs font-bold transition ${
                staffRole === "Admin"
                  ? "bg-primary text-white shadow-card"
                  : "text-on-surface-variant"
              }`}
            >
              Администратор
            </button>
            <button
              type="button"
              onClick={() => { setStaffRole("SuperAdmin"); setError(null); }}
              className={`flex-1 rounded-full px-4 py-2 text-xs font-bold transition ${
                staffRole === "SuperAdmin"
                  ? "bg-primary text-white shadow-card"
                  : "text-on-surface-variant"
              }`}
            >
              Суперадмин
            </button>
          </div>

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
            {staffRole === "Admin" ? "Войти как администратор" : "Войти как суперадмин"}
          </Button>
        </form>
      </div>
    </AppShell>
  );
}
