/** Pickup availability derived from a pharmacy's opening hours.
 *
 * Business rule (set in `/cart/pharmacy` pickup tab):
 * - No schedule at all → treat as 24/7, pickup today is always possible.
 * - Open right now AND more than 30 minutes before closing → pickup today.
 * - Otherwise (closed, or closing within 30 min) → pickup tomorrow.
 */
export type PickupAvailability = {
  canPickupToday: boolean;
  /** Short label for the CTA button. */
  buttonText: string;
  /** Human-friendly schedule hint to show next to the address. */
  hoursHint: string;
  /** True when the pharmacy has no schedule set — treated as 24/7. */
  isAllDay: boolean;
};

/** Minimum lead time (minutes) a pharmacy needs before closing to still
 * accept same-day pickup orders. Matches product copy: "не позже 30 минут
 * до закрытия". */
const PICKUP_BUFFER_MINUTES = 30;
const MINUTES_PER_DAY = 24 * 60;

export function getPickupAvailability(
  opensAt: string | null | undefined,
  closesAt: string | null | undefined,
  now: Date = new Date(),
): PickupAvailability {
  if (!opensAt || !closesAt) {
    return {
      canPickupToday: true,
      buttonText: "Забрать сегодня",
      hoursHint: "Круглосуточно",
      isAllDay: true,
    };
  }

  const open = parseTimeToMinutes(opensAt);
  const close = parseTimeToMinutes(closesAt);
  if (open == null || close == null) {
    return {
      canPickupToday: true,
      buttonText: "Забрать сегодня",
      hoursHint: "Круглосуточно",
      isAllDay: true,
    };
  }

  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const overnight = close <= open;
  const { isOpen, minutesUntilClose } = computeOpenState(
    nowMinutes,
    open,
    close,
    overnight,
  );

  const hoursHint = `${formatHHMM(opensAt)}–${formatHHMM(closesAt)}`;

  if (isOpen && minutesUntilClose > PICKUP_BUFFER_MINUTES) {
    return { canPickupToday: true, buttonText: "Забрать сегодня", hoursHint, isAllDay: false };
  }

  return { canPickupToday: false, buttonText: "Забрать завтра", hoursHint, isAllDay: false };
}

function computeOpenState(
  nowMinutes: number,
  openMinutes: number,
  closeMinutes: number,
  overnight: boolean,
): { isOpen: boolean; minutesUntilClose: number } {
  if (!overnight) {
    const isOpen = nowMinutes >= openMinutes && nowMinutes < closeMinutes;
    return { isOpen, minutesUntilClose: isOpen ? closeMinutes - nowMinutes : 0 };
  }

  // Overnight schedule e.g. 22:00 – 06:00. "Today" is considered still
  // inside the shift while we are either past the opening hour or before the
  // morning closing hour.
  if (nowMinutes >= openMinutes) {
    return {
      isOpen: true,
      minutesUntilClose: closeMinutes + MINUTES_PER_DAY - nowMinutes,
    };
  }
  if (nowMinutes < closeMinutes) {
    return { isOpen: true, minutesUntilClose: closeMinutes - nowMinutes };
  }
  return { isOpen: false, minutesUntilClose: 0 };
}

function parseTimeToMinutes(input: string): number | null {
  const [hStr, mStr] = input.split(":");
  const h = Number.parseInt(hStr ?? "", 10);
  const m = Number.parseInt(mStr ?? "", 10);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
  if (h < 0 || h > 23 || m < 0 || m > 59) return null;
  return h * 60 + m;
}

function formatHHMM(input: string): string {
  // Strip seconds from "HH:mm:ss" (backend TimeOnly serialization).
  return input.length >= 5 ? input.slice(0, 5) : input;
}
