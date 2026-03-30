"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { getMapProvider, type GeoPoint } from "@/shared/lib/map";

type Props = {
  value: string;
  onChange: (address: string) => void;
  onValidChange?: (isValid: boolean) => void;
  onCoordinatesChange?: (coords: GeoPoint | null) => void;
  placeholder?: string;
  className?: string;
};

export function AddressAutocomplete({ value, onChange, onValidChange, onCoordinatesChange, placeholder = "Введите адрес...", className = "" }: Props) {
  const [suggestions, setSuggestions] = useState<{ title: string; subtitle?: string }[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [inputValue, setInputValue] = useState(value);
  const [isValidated, setIsValidated] = useState<boolean | null>(value ? true : null);
  const [isSearching, setIsSearching] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const selectedRef = useRef(false);

  useEffect(() => { setInputValue(value); }, [value]);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setIsOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const setValid = useCallback((v: boolean | null) => {
    setIsValidated(v);
    if (onValidChange) onValidChange(v === true);
  }, [onValidChange]);

  function onInputChange(val: string) {
    setInputValue(val);
    onChange(val);
    selectedRef.current = false;
    onCoordinatesChange?.(null);

    if (val.trim().length === 0) {
      setSuggestions([]); setIsOpen(false); setValid(null);
      return;
    }

    setValid(null);

    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (val.trim().length < 2) { setSuggestions([]); setIsOpen(false); return; }

    debounceRef.current = setTimeout(async () => {
      setIsSearching(true);
      try {
        const provider = getMapProvider();
        const options = await provider.suggest(val);
        setSuggestions(options);
        setIsOpen(options.length > 0);
      } catch {
        setSuggestions([]); setIsOpen(false);
      }
      setIsSearching(false);
    }, 350);
  }

  async function onSelect(item: { title: string; subtitle?: string }) {
    const fullAddress = item.subtitle ? `${item.title}, ${item.subtitle}` : item.title;
    setInputValue(fullAddress);
    onChange(fullAddress);
    setIsOpen(false);
    setSuggestions([]);
    selectedRef.current = true;
    setValid(true);

    const provider = getMapProvider();
    const coords = await provider.geocode(fullAddress);
    onCoordinatesChange?.(coords);
  }

  const borderColor = isValidated === false
    ? "ring-2 ring-red-400"
    : isValidated === true
      ? "ring-2 ring-emerald-400"
      : "";

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <div className={`rounded-xl transition ${borderColor}`}>
        <input
          className="stitch-input w-full"
          type="text"
          value={inputValue}
          onChange={(e) => onInputChange(e.target.value)}
          placeholder={placeholder}
          autoComplete="off"
        />
      </div>

      {isValidated === false && inputValue.trim().length > 0 ? (
        <p className="mt-1 text-xs text-red-600">Адрес не найден. Выберите из подсказок.</p>
      ) : null}
      {isSearching ? (
        <p className="mt-1 text-xs text-on-surface-variant">Поиск адреса...</p>
      ) : null}

      {isOpen && suggestions.length > 0 ? (
        <div className="absolute left-0 right-0 top-full z-50 mt-1 rounded-xl border border-surface-container-high bg-surface-container-lowest shadow-glass overflow-hidden max-h-[50vh] overflow-y-auto">
          {suggestions.map((s, i) => (
            <button
              key={i}
              type="button"
              className="flex w-full items-start gap-2 px-4 py-3 text-left text-sm hover:bg-surface-container-low transition"
              onClick={() => onSelect(s)}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="mt-0.5 flex-shrink-0 text-primary" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
              </svg>
              <div>
                <span className="font-bold">{s.title}</span>
                {s.subtitle ? <span className="text-xs text-on-surface-variant block">{s.subtitle}</span> : null}
              </div>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
