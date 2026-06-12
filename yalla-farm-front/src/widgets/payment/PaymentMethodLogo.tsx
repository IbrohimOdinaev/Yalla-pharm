import type { PaymentMethodId } from "@/widgets/payment/PaymentMethodModal";

type PaymentMethodLogoProps = {
  methodId: PaymentMethodId;
  className?: string;
  imageClassName?: string;
};

const PAYMENT_LOGOS: Record<PaymentMethodId, { src: string; alt: string }> = {
  dc: {
    src: "/payment-logos/dushanbe-city.svg",
    alt: "Dushanbe City",
  },
  alif: {
    src: "/payment-logos/alif.svg",
    alt: "Alif Mobi",
  },
  eskhata: {
    src: "/payment-logos/eskhata.svg",
    alt: "Эсхата",
  },
};

export function PaymentMethodLogo({
  methodId,
  className = "",
  imageClassName = "",
}: PaymentMethodLogoProps) {
  const logo = PAYMENT_LOGOS[methodId];

  return (
    <span
      className={`flex flex-shrink-0 items-center justify-center overflow-hidden rounded-xl bg-surface-container-lowest shadow-sm ${className}`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={logo.src}
        alt={logo.alt}
        className={`block h-full w-full object-contain ${imageClassName}`}
      />
    </span>
  );
}
