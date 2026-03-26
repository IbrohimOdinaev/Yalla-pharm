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
            <input
              className="stitch-input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
            />
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
