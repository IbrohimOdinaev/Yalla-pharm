"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";
import { Icon, type IconName } from "./Icon";

type Tone = "neutral" | "primary" | "secondary" | "tertiary" | "success" | "warning" | "danger" | "accent";

type Props = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "type"> & {
  leftIcon?: IconName;
  selected?: boolean;
  tone?: Tone;
  size?: "sm" | "md";
  asButton?: boolean;
  children: ReactNode;
};

// Yandex-flat: filled pastel backgrounds, saturated text, no border.
const toneInactive: Record<Tone, string> = {
  neutral: "bg-surface-container text-on-surface",
  primary: "bg-primary-soft text-primary",
  secondary: "bg-secondary-soft text-secondary",
  tertiary: "bg-tertiary-soft text-tertiary",
  success: "bg-primary-soft text-primary",
  warning: "bg-warning-soft text-warning",
  danger: "bg-secondary-soft text-secondary",
  accent: "bg-accent text-on-surface",
};

const toneActive = "bg-on-surface text-white";

export function Chip({
  leftIcon,
  selected,
  tone = "neutral",
  size = "md",
  asButton = true,
  className = "",
  children,
  ...rest
}: Props) {
  const base = `inline-flex items-center gap-1.5 rounded-full font-semibold whitespace-nowrap transition ${
    size === "sm" ? "h-7 px-2.5 text-[11px]" : "h-9 px-3.5 text-xs"
  } ${selected ? toneActive : toneInactive[tone]} ${asButton ? "active:scale-95 hover:brightness-95" : ""} ${className}`;

  if (asButton) {
    return (
      <button type="button" className={base} {...rest}>
        {leftIcon ? <Icon name={leftIcon} size={size === "sm" ? 12 : 14} /> : null}
        {children}
      </button>
    );
  }
  return (
    <span className={base}>
      {leftIcon ? <Icon name={leftIcon} size={size === "sm" ? 12 : 14} /> : null}
      {children}
    </span>
  );
}
