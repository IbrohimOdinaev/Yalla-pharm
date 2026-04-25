"use client";

import { useEffect, useRef, useState } from "react";

const MONTHS_RU = [
  "Январь", "Февраль", "Март", "Апрель", "Май", "Июнь",
  "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь",
];
const DAYS_RU = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];

function pad(n: number) { return String(n).padStart(2, "0"); }
function toIso(d: Date) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }
function fromIso(s: string): Date | null {
  if (!s) return null;
  const [y, m, d] = s.split("-").map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}
function formatDisplay(s: string) {
  const d = fromIso(s);
  return d ? `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}` : "";
}

/** Apply DD.MM.YYYY mask while user types — strips non-digits, inserts dots. */
function applyMask(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 8);
  if (digits.length === 0) return "";
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}.${digits.slice(2)}`;
  return `${digits.slice(0, 2)}.${digits.slice(2, 4)}.${digits.slice(4)}`;
}

/** Parse DD.MM.YYYY (or 1-2 / 1-2 / 2-4 with `.` `/` or `-`) into ISO. */
function parseDisplay(s: string): string | null {
  const m = s.trim().match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})$/);
  if (!m) return null;
  const day = Number(m[1]);
  const mon = Number(m[2]);
  const yRaw = Number(m[3]);
  const year = m[3].length === 2 ? 2000 + yRaw : yRaw;
  if (year < 1900 || year > 2100) return null;
  if (mon < 1 || mon > 12) return null;
  if (day < 1 || day > 31) return null;
  const dt = new Date(year, mon - 1, day);
  if (dt.getFullYear() !== year || dt.getMonth() !== mon - 1 || dt.getDate() !== day) return null;
  return toIso(dt);
}

type Props = {
  value: string; // ISO YYYY-MM-DD
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  compact?: boolean;
};

/**
 * Text-editable date picker.
 *
 * Trigger is a real `<input>` masked as `ДД.ММ.ГГГГ` — user can type the
 * date directly. A calendar icon next to it opens a popover with a clickable
 * month grid; clicking the year header swaps the grid for a 4×3 year-picker
 * with arrow scroll for browsing further back / forward 12 years at a time.
 *
 * Replaces native `<input type="date">` (whose browser-chrome popup misbehaves
 * in Chrome's responsive mode and several mobile webviews).
 */
export function DatePicker({
  value,
  onChange,
  placeholder = "ДД.ММ.ГГГГ",
  className = "",
  compact = false,
}: Props) {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<Date>(() => fromIso(value) ?? new Date());
  const [mode, setMode] = useState<"days" | "years">("days");
  const [draft, setDraft] = useState(() => formatDisplay(value));
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync draft text when external value changes (and input is not currently focused).
  useEffect(() => {
    if (document.activeElement !== inputRef.current) {
      setDraft(formatDisplay(value));
    }
  }, [value]);

  // Close on outside click / Escape.
  useEffect(() => {
    if (!open) return;
    function onMouseDown(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
        setMode("days");
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(false);
        setMode("days");
      }
    }
    document.addEventListener("mousedown", onMouseDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onMouseDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // Re-anchor visible month when opening if value points elsewhere.
  useEffect(() => {
    if (!open) return;
    const d = fromIso(value);
    if (d) setView(d);
    setMode("days");
  }, [open, value]);

  function commitDraft() {
    const iso = parseDisplay(draft);
    if (iso) {
      onChange(iso);
      setDraft(formatDisplay(iso));
      const d = fromIso(iso);
      if (d) setView(d);
    } else if (draft.trim() === "") {
      onChange("");
    } else {
      // invalid, revert to last known good
      setDraft(formatDisplay(value));
    }
  }

  function selectDay(iso: string) {
    onChange(iso);
    setDraft(formatDisplay(iso));
    setOpen(false);
    setMode("days");
  }

  const today = new Date();
  const todayIso = toIso(today);
  const year = view.getFullYear();
  const month = view.getMonth();

  // ───── Build day grid (Monday-first) ─────
  const firstWeekday = (new Date(year, month, 1).getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const prevDays = new Date(year, month, 0).getDate();

  type Cell = { iso: string; day: number; thisMonth: boolean };
  const cells: Cell[] = [];
  for (let i = firstWeekday - 1; i >= 0; i--) {
    const d = new Date(year, month - 1, prevDays - i);
    cells.push({ iso: toIso(d), day: prevDays - i, thisMonth: false });
  }
  for (let i = 1; i <= daysInMonth; i++) {
    cells.push({ iso: toIso(new Date(year, month, i)), day: i, thisMonth: true });
  }
  while (cells.length < 42) {
    const next = cells.length - firstWeekday - daysInMonth + 1;
    cells.push({ iso: toIso(new Date(year, month + 1, next)), day: next, thisMonth: false });
  }

  // ───── Year picker grid (12 years per page) ─────
  // Start the grid at year - 6 so the current year sits roughly in the middle.
  const yearPageBase = year - (year % 12);

  function shiftMonth(delta: number) {
    setView(new Date(year, month + delta, 1));
  }

  return (
    <div ref={wrapperRef} className={`relative ${className}`}>
      <div
        className={`flex w-full items-center rounded-2xl border border-outline/70 bg-surface-container-lowest text-on-surface transition focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20 ${
          compact ? "px-2 py-1.5" : "px-3 py-2"
        }`}
      >
        <input
          ref={inputRef}
          type="text"
          inputMode="numeric"
          autoComplete="off"
          value={draft}
          placeholder={placeholder}
          onChange={(e) => setDraft(applyMask(e.target.value))}
          onBlur={commitDraft}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              commitDraft();
              setOpen(false);
            }
          }}
          className={`min-w-0 flex-1 bg-transparent tabular-nums outline-none placeholder:text-on-surface-variant/60 ${
            compact ? "text-xs" : "text-sm"
          }`}
        />
        <button
          type="button"
          onClick={() => setOpen(!open)}
          className="flex flex-shrink-0 items-center justify-center rounded-lg text-on-surface-variant transition hover:bg-surface-container-low"
          aria-label="Открыть календарь"
          aria-haspopup="dialog"
          aria-expanded={open}
          style={{ width: compact ? 24 : 28, height: compact ? 24 : 28 }}
        >
          <svg width={compact ? 14 : 16} height={compact ? 14 : 16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="4" width="18" height="18" rx="2" />
            <line x1="3" y1="10" x2="21" y2="10" />
            <line x1="8" y1="2" x2="8" y2="6" />
            <line x1="16" y1="2" x2="16" y2="6" />
          </svg>
        </button>
      </div>

      {open ? (
        <div className="absolute left-0 top-full z-30 mt-1 w-[280px] rounded-2xl border border-outline/70 bg-surface-container-lowest p-3 shadow-float animate-in">
          {mode === "days" ? (
            <>
              {/* Header: month nav + clickable year */}
              <div className="mb-2 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => shiftMonth(-1)}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-on-surface-variant transition hover:bg-surface-container-low"
                  aria-label="Прошлый месяц"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="15 18 9 12 15 6"/></svg>
                </button>
                <button
                  type="button"
                  onClick={() => setMode("years")}
                  className="rounded-lg px-2 py-1 text-sm font-bold transition hover:bg-surface-container-low"
                  title="Сменить год"
                >
                  {MONTHS_RU[month]} {year}
                </button>
                <button
                  type="button"
                  onClick={() => shiftMonth(1)}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-on-surface-variant transition hover:bg-surface-container-low"
                  aria-label="Следующий месяц"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="9 18 15 12 9 6"/></svg>
                </button>
              </div>

              <div className="mb-1 grid grid-cols-7 gap-0.5">
                {DAYS_RU.map((d) => (
                  <div key={d} className="text-center text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">{d}</div>
                ))}
              </div>

              <div className="grid grid-cols-7 gap-0.5">
                {cells.map((c, i) => {
                  const isSelected = c.iso === value;
                  const isToday = c.iso === todayIso;
                  return (
                    <button
                      key={i}
                      type="button"
                      onClick={() => selectDay(c.iso)}
                      className={`aspect-square rounded-lg text-xs font-semibold transition ${
                        isSelected
                          ? "bg-primary text-white"
                          : !c.thisMonth
                            ? "text-on-surface-variant/40 hover:bg-surface-container-low"
                            : isToday
                              ? "bg-primary/10 text-primary hover:bg-primary/20"
                              : "text-on-surface hover:bg-surface-container-low"
                      }`}
                    >
                      {c.day}
                    </button>
                  );
                })}
              </div>

              <div className="mt-3 flex items-center justify-between border-t border-outline/50 pt-3">
                <button
                  type="button"
                  onClick={() => { onChange(""); setDraft(""); setOpen(false); }}
                  className="text-xs font-semibold text-on-surface-variant transition hover:text-red-600"
                >
                  Очистить
                </button>
                <button
                  type="button"
                  onClick={() => selectDay(todayIso)}
                  className="text-xs font-semibold text-primary transition hover:text-primary-container"
                >
                  Сегодня
                </button>
              </div>
            </>
          ) : (
            // ─── Years view ───
            <>
              <div className="mb-2 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setView(new Date(year - 12, month, 1))}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-on-surface-variant transition hover:bg-surface-container-low"
                  aria-label="Назад на 12 лет"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="15 18 9 12 15 6"/></svg>
                </button>
                <button
                  type="button"
                  onClick={() => setMode("days")}
                  className="rounded-lg px-2 py-1 text-sm font-bold transition hover:bg-surface-container-low"
                >
                  {yearPageBase} – {yearPageBase + 11}
                </button>
                <button
                  type="button"
                  onClick={() => setView(new Date(year + 12, month, 1))}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-on-surface-variant transition hover:bg-surface-container-low"
                  aria-label="Вперёд на 12 лет"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="9 18 15 12 9 6"/></svg>
                </button>
              </div>

              <div className="grid grid-cols-3 gap-1">
                {Array.from({ length: 12 }, (_, i) => yearPageBase + i).map((y) => {
                  const isSelected = y === year;
                  const isCurrent = y === today.getFullYear();
                  return (
                    <button
                      key={y}
                      type="button"
                      onClick={() => {
                        setView(new Date(y, month, 1));
                        setMode("days");
                      }}
                      className={`rounded-lg px-2 py-3 text-sm font-semibold transition ${
                        isSelected
                          ? "bg-primary text-white"
                          : isCurrent
                            ? "bg-primary/10 text-primary hover:bg-primary/20"
                            : "text-on-surface hover:bg-surface-container-low"
                      }`}
                    >
                      {y}
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}
