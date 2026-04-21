import { formatMoney } from "@/shared/lib/format";

type Props = {
  price?: number | null;
  oldPrice?: number | null;
  fromLabel?: boolean;
  suffix?: string;
  size?: "sm" | "md" | "lg";
  className?: string;
};

const sizes = {
  sm: { main: "text-sm", old: "text-[10px]" },
  md: { main: "text-base", old: "text-[11px]" },
  lg: { main: "text-xl", old: "text-xs" },
};

export function PriceTag({ price, oldPrice, fromLabel, suffix, size = "md", className = "" }: Props) {
  const s = sizes[size];
  if (price == null) {
    return <span className={`font-semibold text-on-surface-variant ${s.main} ${className}`}>—</span>;
  }
  return (
    <span className={`inline-flex items-baseline gap-1.5 ${className}`}>
      {oldPrice && oldPrice > price ? (
        <span className={`font-medium text-on-surface-variant/70 line-through ${s.old}`}>
          {formatMoney(oldPrice)}
        </span>
      ) : null}
      <span className={`font-extrabold text-primary tabular-nums ${s.main}`}>
        {fromLabel ? "от " : ""}
        {formatMoney(price)}
      </span>
      {suffix ? <span className="text-xs text-on-surface-variant">{suffix}</span> : null}
    </span>
  );
}
