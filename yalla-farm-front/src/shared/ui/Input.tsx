"use client";

import type { InputHTMLAttributes, ReactNode } from "react";
import { forwardRef } from "react";

type Props = InputHTMLAttributes<HTMLInputElement> & {
  label?: string;
  hint?: string;
  error?: string;
  prefix?: ReactNode;
  suffix?: ReactNode;
  containerClassName?: string;
};

export const Input = forwardRef<HTMLInputElement, Props>(function Input(
  { label, hint, error, prefix, suffix, className = "", containerClassName = "", ...rest },
  ref
) {
  const fieldState = error ? "ring-2 ring-secondary/50" : "focus-within:ring-2 focus-within:ring-primary/30";
  return (
    <label className={`block ${containerClassName}`}>
      {label ? (
        <span className="mb-1.5 block text-xs font-semibold text-on-surface-variant">{label}</span>
      ) : null}
      <span
        className={`flex items-center gap-2 rounded-2xl bg-surface-container-low px-3.5 transition ${fieldState}`}
      >
        {prefix ? <span className="text-on-surface-variant">{prefix}</span> : null}
        <input
          ref={ref}
          className={`min-w-0 flex-1 bg-transparent py-3 text-base text-on-surface placeholder:text-on-surface-variant/60 outline-none ${className}`}
          {...rest}
        />
        {suffix ? <span className="text-on-surface-variant">{suffix}</span> : null}
      </span>
      {error ? (
        <span className="mt-1 block text-[11px] font-semibold text-secondary">{error}</span>
      ) : hint ? (
        <span className="mt-1 block text-[11px] text-on-surface-variant">{hint}</span>
      ) : null}
    </label>
  );
});
