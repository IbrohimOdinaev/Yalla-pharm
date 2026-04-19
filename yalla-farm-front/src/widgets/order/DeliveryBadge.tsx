type Props = {
  isPickup: boolean;
  /** Compact mode without text label, just the icon. */
  iconOnly?: boolean;
};

export function DeliveryBadge({ isPickup, iconOnly }: Props) {
  if (isPickup) {
    return (
      <span
        className="inline-flex items-center gap-1 rounded-full bg-orange-100 px-1.5 py-0.5 text-[10px] font-bold text-orange-700"
        title="Самовывоз"
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <circle cx="12" cy="5" r="2.5" />
          <path d="M12 7.5v6" />
          <path d="M9 10l3 1.5 3-1.5" />
          <path d="M9 21l3-7 3 7" />
        </svg>
        {iconOnly ? null : <span>Самовывоз</span>}
      </span>
    );
  }
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] font-bold text-emerald-700"
      title="Доставка"
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M3 16V8h11l3 4h4v4" />
        <circle cx="7" cy="17" r="2" />
        <circle cx="17" cy="17" r="2" />
        <path d="M9 17h6" />
      </svg>
      {iconOnly ? null : <span>Доставка</span>}
    </span>
  );
}

/** Tailwind border classes for an order card depending on delivery type. */
export function deliveryBorderClass(isPickup: boolean) {
  return isPickup ? "border-2 border-orange-500" : "border-2 border-emerald-500";
}
