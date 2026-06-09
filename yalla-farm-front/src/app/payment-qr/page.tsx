"use client";

import { Suspense } from "react";
import { QRCodeSVG } from "qrcode.react";
import { useSearchParams } from "next/navigation";
import { formatMoney } from "@/shared/lib/format";
import { isAllowedPaymentUrl, openPaymentUrl } from "@/shared/lib/paymentWindow";
import { Button, Icon } from "@/shared/ui";

function readAmount(value: string | null): string | null {
  const amount = Number(String(value ?? "").replace(",", "."));
  if (!Number.isFinite(amount) || amount <= 0) return null;
  return formatMoney(amount);
}

function PaymentQrContent() {
  const params = useSearchParams();
  const paymentUrl = params.get("url") ?? "";
  const title = params.get("title")?.trim() || "Оплата";
  const subtitle = params.get("subtitle")?.trim() || "";
  const amount = readAmount(params.get("amount"));
  const allowed = isAllowedPaymentUrl(paymentUrl);

  return (
    <main className="flex min-h-dvh items-center justify-center bg-surface-container-low px-4 py-8">
      <section className="w-full max-w-md rounded-[28px] border border-outline/70 bg-surface-container-lowest p-5 text-center shadow-float">
        <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-2xl bg-primary-soft text-primary">
          <Icon name="bag" size={22} />
        </div>
        <h1 className="font-display text-xl font-extrabold text-on-surface">{title}</h1>
        {subtitle ? <p className="mt-1 text-sm text-on-surface-variant">{subtitle}</p> : null}
        {amount ? <p className="mt-2 text-sm font-bold text-primary">{amount}</p> : null}

        {allowed ? (
          <>
            <div className="mx-auto mt-5 grid w-fit place-items-center rounded-3xl border border-outline/60 bg-white p-4">
              <QRCodeSVG
                value={paymentUrl}
                size={280}
                level="M"
                marginSize={2}
                fgColor="#1A1C1B"
                bgColor="#FFFFFF"
                title={`${title}: QR для оплаты`}
              />
            </div>
            <p className="mt-4 text-xs leading-relaxed text-on-surface-variant">
              Отсканируйте QR телефоном или откройте оплату на этом устройстве.
            </p>
            <Button
              size="md"
              fullWidth
              rightIcon="arrow-right"
              className="mt-4"
              onClick={() => openPaymentUrl(paymentUrl)}
            >
              Открыть оплату
            </Button>
          </>
        ) : (
          <div className="mt-5 rounded-2xl bg-secondary/10 p-4 text-sm font-semibold text-secondary">
            Ссылка оплаты недоступна.
          </div>
        )}
      </section>
    </main>
  );
}

export default function PaymentQrPage() {
  return (
    <Suspense fallback={<main className="p-6 text-sm">Загрузка QR...</main>}>
      <PaymentQrContent />
    </Suspense>
  );
}
