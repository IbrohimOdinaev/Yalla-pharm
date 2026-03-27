"use client";

import { useState, useRef, useEffect, useCallback } from "react";

type AddressOption = {
  displayName: string;
  lat: string;
  lon: string;
};

type Props = {
  value: string;
  onChange: (address: string) => void;
  /** Called when address validation state changes */
  onValidChange?: (isValid: boolean) => void;
  placeholder?: string;
  className?: string;
};

async function searchNominatim(query: string): Promise<AddressOption[]> {
  const encoded = encodeURIComponent(`${query.trim()}, Душанбе`);
  const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encoded}&addressdetails=1&limit=5&countrycodes=tj&viewbox=68.65,38.50,68.85,38.62&bounded=1`;
  const res = await fetch(url, { headers: { "Accept-Language": "ru" } });
  const data = await res.json();
  return (data || []).map((item: Record<string, string>) => ({
    displayName: item.display_name || "",
    lat: item.lat || "",
    lon: item.lon || "",
  }));
}

function cleanDisplayName(raw: string): string {
  const parts = raw.split(",").map((s) => s.trim());
  // Remove country-level parts (Таджикистан, Душанбе city duplicate, postal code)
  const filtered = parts.filter((p) =>
    !/^(Tajikistan|Таджикистан|TJ|Dushanbe|Душанбе|Районы|республиканского|подчинения|\d{5,6})$/i.test(p)
  );
  return filtered.slice(0, 3).join(", ");
}

export function AddressAutocomplete({ value, onChange, onValidChange, placeholder = "Введите адрес...", className = "" }: Props) {
  const [suggestions, setSuggestions] = useState<AddressOption[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [inputValue, setInputValue] = useState(value);
  const [isValidated, setIsValidated] = useState<boolean | null>(value ? true : null); // null = not checked, true = valid, false = invalid
  const [isSearching, setIsSearching] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const validateRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const selectedFromSuggestion = useRef(false);

  useEffect(() => { setInputValue(value); }, [value]);

  // Close on outside click
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
    selectedFromSuggestion.current = false;

    if (val.trim().length === 0) {
      setSuggestions([]);
      setIsOpen(false);
      setValid(null);
      return;
    }

    // Mark as unvalidated while typing
    setValid(null);

    // Fetch suggestions
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (val.trim().length < 2) { setSuggestions([]); setIsOpen(false); return; }

    debounceRef.current = setTimeout(async () => {
      setIsSearching(true);
      try {
        const options = await searchNominatim(val);
        setSuggestions(options);
        setIsOpen(options.length > 0);
      } catch {
        setSuggestions([]);
        setIsOpen(false);
      }
      setIsSearching(false);
    }, 350);

    // Validate after user stops typing (longer delay)
    if (validateRef.current) clearTimeout(validateRef.current);
    validateRef.current = setTimeout(async () => {
      if (selectedFromSuggestion.current) return; // already validated
      try {
        const results = await searchNominatim(val);
        setValid(results.length > 0);
      } catch {
        setValid(false);
      }
    }, 1200);
  }

  function onSelect(option: AddressOption) {
    const cleaned = cleanDisplayName(option.displayName);
    setInputValue(cleaned);
    onChange(cleaned);
    setIsOpen(false);
    setSuggestions([]);
    selectedFromSuggestion.current = true;
    setValid(true); // selected from Nominatim = valid
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

      {/* Validation feedback */}
      {isValidated === false && inputValue.trim().length > 0 ? (
        <p className="mt-1 text-xs text-red-600">Адрес не найден в Душанбе. Выберите из подсказок.</p>
      ) : null}
      {isSearching ? (
        <p className="mt-1 text-xs text-on-surface-variant">Поиск адреса...</p>
      ) : null}

      {/* Suggestions dropdown */}
      {isOpen && suggestions.length > 0 ? (
        <div className="absolute left-0 right-0 top-full z-50 mt-1 rounded-xl border border-surface-container-high bg-surface-container-lowest shadow-glass overflow-hidden max-h-[50vh] overflow-y-auto">
          {suggestions.map((s, i) => {
            const cleaned = cleanDisplayName(s.displayName);
            const parts = cleaned.split(",").map((p) => p.trim());
            const main = parts[0];
            const secondary = parts.slice(1).join(", ");
            return (
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
                  <span className="font-bold">{main}</span>
                  {secondary ? <span className="text-xs text-on-surface-variant block">{secondary}</span> : null}
                </div>
              </button>
            );
          })}
          <div className="px-4 py-1.5 text-[9px] text-on-surface-variant/50 border-t border-surface-container-high">
            OpenStreetMap
          </div>
        </div>
      ) : null}
    </div>
  );
}
