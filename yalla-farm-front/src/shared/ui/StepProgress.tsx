import { Icon } from "./Icon";

type Step = { label: string };

type Props = {
  steps: Step[];
  current: number;
  className?: string;
};

export function StepProgress({ steps, current, className = "" }: Props) {
  return (
    <ol className={`flex items-center gap-2 ${className}`}>
      {steps.map((s, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <li key={i} className="flex flex-1 items-center gap-2">
            <span
              className={`flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-[11px] font-extrabold ${
                done
                  ? "bg-primary text-white"
                  : active
                    ? "bg-primary/15 text-primary ring-2 ring-primary ring-offset-2 ring-offset-surface"
                    : "bg-surface-container-low text-on-surface-variant"
              }`}
            >
              {done ? <Icon name="check" size={14} /> : i + 1}
            </span>
            <span
              className={`min-w-0 truncate text-xs font-bold ${
                active ? "text-on-surface" : done ? "text-primary" : "text-on-surface-variant"
              }`}
            >
              {s.label}
            </span>
            {i < steps.length - 1 ? (
              <span
                className={`h-0.5 flex-1 rounded-full ${done ? "bg-primary" : "bg-surface-container-high"}`}
              />
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}
