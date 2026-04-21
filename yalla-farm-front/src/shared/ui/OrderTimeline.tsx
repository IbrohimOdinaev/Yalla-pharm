import { Icon } from "./Icon";

export type OrderTimelineStep = {
  key: string;
  label: string;
  /** completed / active / pending */
  state: "done" | "active" | "pending" | "skipped";
};

export function OrderTimeline({ steps, className = "" }: { steps: OrderTimelineStep[]; className?: string }) {
  return (
    <ol className={`flex items-start gap-1 ${className}`}>
      {steps.map((s, i) => {
        const isLast = i === steps.length - 1;
        return (
          <li key={s.key} className="flex flex-1 items-start">
            <div className="flex flex-1 flex-col items-center gap-1">
              <div className="flex w-full items-center gap-1">
                {i > 0 ? (
                  <span
                    className={`h-0.5 flex-1 rounded-full ${
                      s.state === "done" || s.state === "active"
                        ? "bg-primary"
                        : "bg-surface-container-high"
                    }`}
                  />
                ) : (
                  <span className="flex-1" />
                )}
                <span
                  className={`flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-[10px] font-extrabold ${
                    s.state === "done"
                      ? "bg-primary text-white"
                      : s.state === "active"
                        ? "bg-primary/15 text-primary ring-2 ring-primary animate-pulse"
                        : s.state === "skipped"
                          ? "bg-surface-container-low text-on-surface-variant/40 line-through"
                          : "bg-surface-container-low text-on-surface-variant"
                  }`}
                >
                  {s.state === "done" ? <Icon name="check" size={14} /> : i + 1}
                </span>
                {!isLast ? (
                  <span
                    className={`h-0.5 flex-1 rounded-full ${
                      s.state === "done"
                        ? "bg-primary"
                        : "bg-surface-container-high"
                    }`}
                  />
                ) : (
                  <span className="flex-1" />
                )}
              </div>
              <span
                className={`text-[10px] text-center font-semibold leading-tight ${
                  s.state === "active"
                    ? "text-primary"
                    : s.state === "done"
                      ? "text-on-surface"
                      : "text-on-surface-variant"
                }`}
              >
                {s.label}
              </span>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
