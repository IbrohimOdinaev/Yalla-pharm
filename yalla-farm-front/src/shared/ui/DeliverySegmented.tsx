"use client";

import { Icon } from "./Icon";

type Props = {
  value: "delivery" | "pickup";
  onChange: (v: "delivery" | "pickup") => void;
  deliveryHint?: string;
  pickupHint?: string;
  className?: string;
};

export function DeliverySegmented({
  value,
  onChange,
  deliveryHint = "30-45 мин",
  pickupHint = "Бесплатно",
  className = "",
}: Props) {
  return (
    <div className={`flex h-12 items-center gap-1 rounded-full bg-surface-container-low p-1 ${className}`}>
      <button
        type="button"
        onClick={() => onChange("delivery")}
        className={`flex h-full flex-1 items-center justify-center gap-2 rounded-full text-xs font-bold transition ${
          value === "delivery"
            ? "bg-primary text-white shadow-card"
            : "text-on-surface-variant hover:bg-surface-container-high"
        }`}
      >
        <Icon name="truck" size={16} />
        <span>Доставка · {deliveryHint}</span>
      </button>
      <button
        type="button"
        onClick={() => onChange("pickup")}
        className={`flex h-full flex-1 items-center justify-center gap-2 rounded-full text-xs font-bold transition ${
          value === "pickup"
            ? "bg-primary text-white shadow-card"
            : "text-on-surface-variant hover:bg-surface-container-high"
        }`}
      >
        <Icon name="store" size={16} />
        <span>Самовывоз · {pickupHint}</span>
      </button>
    </div>
  );
}
