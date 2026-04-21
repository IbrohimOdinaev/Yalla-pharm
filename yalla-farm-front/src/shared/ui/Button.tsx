"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";
import { forwardRef } from "react";
import { Icon, type IconName } from "./Icon";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "outline" | "telegram" | "yellow";
type Size = "sm" | "md" | "lg";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
  leftIcon?: IconName;
  rightIcon?: IconName;
  loading?: boolean;
  fullWidth?: boolean;
  children?: ReactNode;
};

// Yandex-Plus flat variants — primary buttons are warm yellow with near-black
// text (matches Yandex Market/Apteka buy-flow CTA). No gradients, no glow.
const variants: Record<Variant, string> = {
  primary:
    "bg-accent text-on-surface hover:bg-accent-dark active:scale-[0.98]",
  secondary:
    "bg-surface-container text-on-surface hover:bg-surface-container-high active:scale-[0.98]",
  ghost:
    "bg-transparent text-on-surface hover:bg-surface-container active:bg-surface-container-high",
  danger:
    "bg-secondary text-white hover:bg-secondary-container active:scale-[0.98]",
  outline:
    "bg-transparent text-on-surface border border-outline hover:bg-surface-container active:scale-[0.98]",
  telegram:
    "bg-telegram text-white hover:bg-telegram-dark active:scale-[0.98]",
  yellow:
    "bg-accent text-on-surface hover:bg-accent-dark active:scale-[0.98]",
};

const sizes: Record<Size, string> = {
  sm: "h-9 px-4 text-xs gap-1.5 rounded-full",
  md: "h-11 px-5 text-sm gap-2 rounded-full",
  lg: "h-12 px-6 text-sm gap-2 rounded-full",
};

const iconSizes: Record<Size, number> = { sm: 14, md: 18, lg: 18 };

export const Button = forwardRef<HTMLButtonElement, Props>(function Button(
  {
    variant = "primary",
    size = "md",
    leftIcon,
    rightIcon,
    loading,
    fullWidth,
    className = "",
    children,
    disabled,
    ...rest
  },
  ref
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={`inline-flex items-center justify-center font-bold whitespace-nowrap transition disabled:cursor-not-allowed disabled:opacity-50 ${variants[variant]} ${sizes[size]} ${fullWidth ? "w-full" : ""} ${className}`}
      {...rest}
    >
      {loading ? (
        <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
      ) : leftIcon ? (
        <Icon name={leftIcon} size={iconSizes[size]} />
      ) : null}
      {children}
      {!loading && rightIcon ? <Icon name={rightIcon} size={iconSizes[size]} /> : null}
    </button>
  );
});
