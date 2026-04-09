"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { AppShell } from "@/widgets/layout/AppShell";
import { TopBar } from "@/widgets/layout/TopBar";

export default function RegisterRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/login");
  }, [router]);

  return (
    <AppShell top={<TopBar title="Регистрация" backHref="back" />}>
      <div className="mx-auto max-w-md px-3 xs:px-4">
        <div className="stitch-card p-4 xs:p-5 sm:p-6 space-y-3 text-center">
          <h2 className="text-base xs:text-lg sm:text-xl font-bold">Регистрация теперь по SMS</h2>
          <p className="text-xs xs:text-sm text-on-surface-variant">
            Отдельная регистрация больше не требуется. Введите номер телефона на странице входа,
            и аккаунт будет создан автоматически после подтверждения SMS-кода.
          </p>
          <Link href="/login" className="stitch-button inline-block min-h-[44px] px-6 leading-[44px]">
            Перейти ко входу
          </Link>
        </div>
      </div>
    </AppShell>
  );
}
