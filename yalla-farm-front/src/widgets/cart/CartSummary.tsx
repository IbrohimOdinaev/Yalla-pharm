import { formatMoney } from "@/shared/lib/format";

export type CartSummaryRow = {
  label: string;
  value: number;
  tone?: "neutral" | "discount" | "info";
  hint?: string;
};

type Props = {
  rows: CartSummaryRow[];
  total: number;
  hint?: string;
  currency?: string;
};

export function CartSummary({ rows, total, hint, currency = "TJS" }: Props) {
  return (
    <div className="rounded-3xl bg-surface-container-lowest p-5 shadow-card">
      <ul className="space-y-2.5">
        {rows.map((r, i) => {
          const valueCls =
            r.tone === "discount"
              ? "text-secondary"
              : r.tone === "info"
                ? "text-tertiary"
                : "text-on-surface";
          return (
            <li key={i} className="flex items-baseline justify-between gap-4">
              <span className="text-sm text-on-surface-variant">
                {r.label}
                {r.hint ? (
                  <span className="ml-1 text-[11px] text-on-surface-variant/60">· {r.hint}</span>
                ) : null}
              </span>
              <span className={`text-sm font-bold tabular-nums ${valueCls}`}>
                {r.tone === "discount" ? "−" : ""}
                {formatMoney(Math.abs(r.value))} {currency}
              </span>
            </li>
          );
        })}
      </ul>

      <div className="my-4 h-px bg-surface-container-high" />

      <div className="flex items-baseline justify-between">
        <span className="font-display text-lg font-extrabold text-on-surface">Итого</span>
        <span className="font-display text-2xl font-extrabold tabular-nums text-primary">
          {formatMoney(total)} {currency}
        </span>
      </div>

      {hint ? (
        <p className="mt-3 rounded-full bg-accent-sky px-3 py-1.5 text-center text-[11px] font-semibold text-tertiary">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
