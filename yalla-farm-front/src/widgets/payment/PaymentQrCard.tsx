"use client";

import QRCode from "react-qr-code";
import { formatMoney } from "@/shared/lib/format";
import { buildPaymentQrDescription, buildPaymentQrValue } from "@/shared/lib/paymentQrPayload";
import { Button, Icon } from "@/shared/ui";

type PaymentQrCardProps = {
  paymentUrl: string;
  title: string;
  subtitle?: string;
  amount?: number | null;
  allowed: boolean;
  onOpen: () => void;
};

export function PaymentQrCard({ paymentUrl, title, subtitle, amount, allowed, onOpen }: PaymentQrCardProps) {
  const qrValue = buildPaymentQrValue(paymentUrl);
  const qrDescription = buildPaymentQrDescription(paymentUrl);

  return (
    <section className="w-full max-w-md rounded-[28px] border border-outline/70 bg-surface-container-lowest p-5 text-center shadow-float">
      <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-2xl bg-primary-soft text-primary">
        <Icon name="bag" size={22} />
      </div>
      <h1 className="font-display text-xl font-extrabold text-on-surface">{title}</h1>
      {subtitle ? <p className="mt-1 text-sm text-on-surface-variant">{subtitle}</p> : null}
      {amount && amount > 0 ? <p className="mt-2 text-sm font-bold text-primary">{formatMoney(amount)}</p> : null}

      {allowed ? (
        <>
          <div className="mx-auto mt-5 grid w-fit place-items-center rounded-3xl border border-outline/60 bg-white p-4">
            <QRCode
              value={qrValue}
              size={280}
              level="Q"
              fgColor="#000000"
              bgColor="#FFFFFF"
              title={`${title}: QR для оплаты`}
            />
          </div>
          <p className="mt-4 text-xs leading-relaxed text-on-surface-variant">
            {qrDescription}
          </p>
          <Button
            size="md"
            fullWidth
            rightIcon="arrow-right"
            className="mt-4"
            onClick={onOpen}
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
  );
}
