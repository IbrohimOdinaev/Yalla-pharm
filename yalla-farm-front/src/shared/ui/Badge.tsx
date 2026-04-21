import type { ReactNode } from "react";

type Tone = "primary" | "secondary" | "tertiary" | "neutral" | "accent";

type Props = {
  tone?: Tone;
  children: ReactNode;
  className?: string;
  pulse?: boolean;
};

const tones: Record<Tone, string> = {
  primary: "bg-primary text-white",
  secondary: "bg-secondary text-white",
  tertiary: "bg-tertiary text-white",
  neutral: "bg-surface-container-high text-on-surface-variant",
  accent: "bg-accent text-on-surface",
};

export function Badge({ tone = "secondary", children, className = "", pulse }: Props) {
  return (
    <span
      className={`inline-flex min-w-[18px] h-[18px] items-center justify-center rounded-full px-1.5 text-[10px] font-extrabold tabular-nums ${tones[tone]} ${pulse ? "animate-pulse" : ""} ${className}`}
    >
      {children}
    </span>
  );
}
