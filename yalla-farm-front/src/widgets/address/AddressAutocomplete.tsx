"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { env } from "@/shared/config/env";

type SuggestItem = {
  title: string;
  subtitle?: string;
  uri?: string;
};

type Props = {
  value: string;
  onChange: (address: string) => void;
  onValidChange?: (isValid: boolean) => void;
  onCoordinatesChange?: (coords: { lat: number; lng: number } | null) => void;
  placeholder?: string;
  className?: string;
};

async function yandexSuggest(query: string): Promise<SuggestItem[]> {
  const apiKey = env.yandexMapsApiKey;
  if (!apiKey) return nominatimFallback(query);

  const encoded = encodeURIComponent(`Душанбе, ${query.trim()}`);
  const url = `https://suggest-maps.yandex.ru/v1/suggest?apikey=${apiKey}&text=${encoded}&lang=ru&types=geo&print_address=1&bbox=68.65,38.50~68.90,38.65`;

  try {
    const res = await fetch(url);
    const data = await res.json();
    return (data?.results ?? []).map((r: { title?: { text?: string }; subtitle?: { text?: string }; uri?: string }) => ({
      title: r.title?.text ?? "",
      subtitle: r.subtitle?.text ?? "",
      uri: r.uri ?? "",
    }));
  } catch {
    return nominatimFallback(query);
  }
}

async function yandexGeocode(address: string): Promise<{ lat: number; lng: number } | null> {
  const apiKey = env.yandexMapsApiKey;
  if (!apiKey) return null;

  const encoded = encodeURIComponent(address);
  const url = `https://geocode-maps.yandex.ru/v1/?apikey=${apiKey}&geocode=${encoded}&format=json&lang=ru_RU&results=1`;

  try {
    const res = await fetch(url);
    const data = await res.json();
    const pos = data?.response?.GeoObjectCollection?.featureMember?.[0]?.GeoObject?.Point?.pos;
    if (!pos) return null;
    const [lng, lat] = pos.split(" ").map(Number);
    return { lat, lng };
  } catch {
    return null;
  }
}

// Fallback to Nominatim if no Yandex key
async function nominatimFallback(query: string): Promise<SuggestItem[]> {
  const encoded = encodeURIComponent(`${query.trim()}, Душанбе`);
  const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encoded}&limit=5&countrycodes=tj&viewbox=68.65,38.50,68.85,38.62&bounded=1`;
  try {
    const res = await fetch(url, { headers: { "Accept-Language": "ru" } });
    const data = await res.json();
    return (data || []).map((item: Record<string, string>) => {
      const parts = (item.display_name || "").split(",").map((s: string) => s.trim());
      const filtered = parts.filter((p: string) => !/^(Tajikistan|Таджикистан|TJ|\d{5,6})$/i.test(p));
      return { title: filtered[0] || "", subtitle: filtered.slice(1, 3).join(", ") };
    });
  } catch {
    return [];
  }
}

export function AddressAutocomplete({ value, onChange, onValidChange, onCoordinatesChange, placeholder = "Введите адрес...", className = "" }: Props) {
  const [suggestions, setSuggestions] = useState<SuggestItem[]>([]);
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
        const options = await yandexSuggest(val);
        setSuggestions(options);
        setIsOpen(options.length > 0);
      } catch {
        setSuggestions([]); setIsOpen(false);
      }
      setIsSearching(false);
    }, 350);
  }

  async function onSelect(item: SuggestItem) {
    const fullAddress = item.subtitle ? `${item.title}, ${item.subtitle}` : item.title;
    setInputValue(fullAddress);
    onChange(fullAddress);
    setIsOpen(false);
    setSuggestions([]);
    selectedRef.current = true;
    setValid(true);

    // Geocode to get coordinates
    const coords = await yandexGeocode(fullAddress);
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
          <div className="px-4 py-1.5 text-[9px] text-on-surface-variant/50 border-t border-surface-container-high">
            Яндекс Карты
          </div>
        </div>
      ) : null}
    </div>
  );
}
