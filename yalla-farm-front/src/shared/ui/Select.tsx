"use client";

import { useEffect, useRef, useState } from "react";

export type SelectOption = {
  value: string;
  label: string;
  /** Indentation level for hierarchical lists (e.g. parent → child categories). */
  depth?: number;
};

type Props = {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  className?: string;
  /** Override the rendered label when no option matches `value`. */
  emptyLabel?: string;
};

/**
 * Drop-in replacement for native `<select>` that we fully control. Native
 * selects render their dropdown as browser-chrome UI — Chrome's responsive
 * mode (and a few mobile webviews) anchor that popup at the wrong screen
 * coordinates relative to the iframe-scaled page, leaving the menu floating
 * elsewhere. This component is a button + absolute-positioned panel, so the
 * dropdown is always anchored directly below the trigger.
 */
export function Select({
  value,
  onChange,
  options,
  placeholder = "—",
  emptyLabel,
  className = "",
}: Props) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onMouseDown(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onMouseDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onMouseDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const selected = options.find((o) => o.value === value);
  const triggerLabel = selected?.label ?? emptyLabel ?? placeholder;

  return (
    <div ref={wrapperRef} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between rounded-2xl border border-outline/70 bg-surface-container-lowest px-3.5 py-3 text-left text-sm text-on-surface outline-none transition hover:bg-surface-container-low focus:border-primary focus:ring-2 focus:ring-primary/20"
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className="min-w-0 truncate">{triggerLabel}</span>
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          className={`ml-2 flex-shrink-0 text-on-surface-variant transition ${open ? "rotate-180" : ""}`}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {open ? (
        <div
          role="listbox"
          className="absolute left-0 right-0 top-full z-30 mt-1 max-h-[60vh] overflow-y-auto rounded-2xl border border-outline/70 bg-surface-container-lowest p-1 shadow-float animate-in"
        >
          {options.map((opt) => {
            const isSelected = opt.value === value;
            return (
              <button
                key={opt.value || "__empty__"}
                type="button"
                role="option"
                aria-selected={isSelected}
                onClick={() => {
                  onChange(opt.value);
                  setOpen(false);
                }}
                className={`flex w-full items-center rounded-xl px-3 py-2 text-left text-sm transition ${
                  isSelected
                    ? "bg-primary text-white font-bold"
                    : "text-on-surface hover:bg-surface-container-low"
                }`}
                style={opt.depth ? { paddingLeft: `${12 + opt.depth * 16}px` } : undefined}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
