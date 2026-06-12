"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { isAllowedPaymentUrl, openPaymentUrl } from "@/shared/lib/paymentWindow";
import { PaymentQrCard } from "@/widgets/payment/PaymentQrCard";

function readAmount(value: string | null): number | null {
  const amount = Number(String(value ?? "").replace(",", "."));
  if (!Number.isFinite(amount) || amount <= 0) return null;
  return amount;
}

function PaymentQrContent() {
  const params = useSearchParams();
  const paymentUrl = params.get("url") ?? "";
  const title = params.get("title")?.trim() || "Оплата";
  const subtitle = params.get("subtitle")?.trim() || "";
  const amount = readAmount(params.get("amount"));
  const allowed = isAllowedPaymentUrl(paymentUrl);

  return (
    <main className="page-reveal flex min-h-dvh items-center justify-center bg-surface-container-low px-4 py-8">
      <PaymentQrCard
        paymentUrl={paymentUrl}
        title={title}
        subtitle={subtitle}
        amount={amount}
        allowed={allowed}
        onOpen={() => openPaymentUrl(paymentUrl)}
      />
    </main>
  );
}

export default function PaymentQrPage() {
  return (
    <Suspense fallback={<main className="page-reveal p-6 text-sm">Загрузка QR...</main>}>
      <PaymentQrContent />
    </Suspense>
  );
}
