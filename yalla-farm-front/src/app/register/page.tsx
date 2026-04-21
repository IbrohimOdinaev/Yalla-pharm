"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { AppShell } from "@/widgets/layout/AppShell";
import { TopBar } from "@/widgets/layout/TopBar";
import { Button, Icon } from "@/shared/ui";

export default function RegisterRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    const id = setTimeout(() => router.replace("/login"), 1500);
    return () => clearTimeout(id);
  }, [router]);

  return (
    <AppShell hideFooter top={<TopBar title="Регистрация" backHref="back" />}>
      <div className="mx-auto flex max-w-md flex-col items-center gap-4 pt-6 text-center">
        <span className="flex h-20 w-20 items-center justify-center rounded-full bg-accent-mint text-primary">
          <Icon name="sms" size={36} />
        </span>
        <h2 className="font-display text-2xl font-extrabold">Регистрация теперь по SMS</h2>
        <p className="max-w-xs text-sm text-on-surface-variant">
          Отдельная регистрация не требуется. Введите номер телефона на странице входа —
          аккаунт создастся автоматически после SMS-кода.
        </p>
        <Link href="/login">
          <Button size="md" rightIcon="arrow-right">Перейти ко входу</Button>
        </Link>
      </div>
    </AppShell>
  );
}
