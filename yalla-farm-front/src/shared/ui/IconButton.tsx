"use client";

import type { ButtonHTMLAttributes } from "react";
import { forwardRef } from "react";
import { Icon, type IconName } from "./Icon";

type Variant = "neutral" | "primary" | "floating" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  icon: IconName;
  variant?: Variant;
  size?: Size;
  "aria-label": string;
};

const variants: Record<Variant, string> = {
  neutral: "bg-surface-container text-on-surface-variant hover:bg-surface-container-high",
  primary: "bg-primary text-white hover:bg-primary-container",
  floating: "bg-surface-container-lowest text-on-surface border border-outline/70 hover:bg-surface-container",
  ghost: "bg-transparent text-on-surface-variant hover:bg-surface-container",
  danger: "bg-secondary-soft text-secondary hover:bg-secondary/20",
};

const sizes: Record<Size, { btn: string; icon: number }> = {
  sm: { btn: "h-8 w-8", icon: 14 },
  md: { btn: "h-10 w-10", icon: 18 },
  lg: { btn: "h-12 w-12", icon: 22 },
};

export const IconButton = forwardRef<HTMLButtonElement, Props>(function IconButton(
  { icon, variant = "neutral", size = "md", className = "", ...rest },
  ref
) {
  const s = sizes[size];
  return (
    <button
      ref={ref}
      className={`inline-flex items-center justify-center rounded-full transition active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed ${variants[variant]} ${s.btn} ${className}`}
      {...rest}
    >
      <Icon name={icon} size={s.icon} />
    </button>
  );
});
