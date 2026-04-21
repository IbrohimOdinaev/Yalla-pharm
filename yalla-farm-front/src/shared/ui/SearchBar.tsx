"use client";

import type { HTMLAttributes } from "react";
import { Icon } from "./Icon";

type Props = HTMLAttributes<HTMLButtonElement> & {
  placeholder?: string;
  variant?: "hero" | "compact";
};

// Yandex-style search: filled grey bar with search icon left, mic + camera icons right.
export function SearchBar({
  placeholder = "Найти лекарства, витамины, тесты",
  variant = "hero",
  className = "",
  ...rest
}: Props) {
  if (variant === "hero") {
    return (
      <button
        type="button"
        className={`group flex h-12 w-full items-center gap-3 rounded-full bg-surface-container px-4 text-left transition hover:bg-surface-container-high focus:ring-2 focus:ring-primary/20 ${className}`}
        {...rest}
      >
        <Icon name="search" size={20} className="flex-shrink-0 text-on-surface" />
        <span className="flex-1 truncate text-sm text-on-surface-variant">
          {placeholder}
        </span>
        <span className="flex items-center gap-2 text-on-surface/70">
          <Icon name="mic" size={18} />
        </span>
      </button>
    );
  }

  return (
    <button
      type="button"
      className={`flex h-10 items-center gap-2.5 rounded-full bg-surface-container px-4 text-left transition hover:bg-surface-container-high ${className}`}
      {...rest}
    >
      <Icon name="search" size={16} className="text-on-surface" />
      <span className="truncate text-sm text-on-surface-variant">{placeholder}</span>
    </button>
  );
}
