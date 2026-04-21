import type { SVGProps } from "react";

export type IconName =
  | "search"
  | "mic"
  | "pin"
  | "pharmacy"
  | "user"
  | "cart"
  | "bag"
  | "heart"
  | "share"
  | "star"
  | "plus"
  | "minus"
  | "close"
  | "check"
  | "chevron-left"
  | "chevron-right"
  | "chevron-down"
  | "chevron-up"
  | "arrow-right"
  | "arrow-left"
  | "back"
  | "clock"
  | "bolt"
  | "truck"
  | "store"
  | "phone"
  | "message"
  | "telegram"
  | "sms"
  | "logout"
  | "login"
  | "trash"
  | "edit"
  | "filter"
  | "grid"
  | "list"
  | "map"
  | "home"
  | "orders"
  | "warning"
  | "info"
  | "gift"
  | "coin"
  | "settings"
  | "headphones"
  | "help"
  | "mic-off"
  | "camera"
  | "photo"
  | "eye"
  | "eye-off"
  | "card"
  | "cash"
  | "crosshair";

type Props = SVGProps<SVGSVGElement> & { name: IconName; size?: number };

export function Icon({ name, size = 20, strokeWidth = 2, ...rest }: Props) {
  const common = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
    ...rest,
  };
  switch (name) {
    case "search":
      return <svg {...common}><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" /></svg>;
    case "mic":
      return <svg {...common}><rect x="9" y="3" width="6" height="12" rx="3" /><path d="M5 11a7 7 0 0 0 14 0" /><path d="M12 18v3" /></svg>;
    case "pin":
      return <svg {...common}><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 1 1 16 0Z" /><circle cx="12" cy="10" r="3" /></svg>;
    case "pharmacy":
      return <svg {...common}><path d="M3 21h18" /><path d="M5 21V6a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v15" /><path d="M12 9v6" /><path d="M9 12h6" /></svg>;
    case "user":
      return <svg {...common}><circle cx="12" cy="8" r="4" /><path d="M20 21a8 8 0 1 0-16 0" /></svg>;
    case "cart":
      return <svg {...common}><circle cx="9" cy="21" r="1.3" /><circle cx="19" cy="21" r="1.3" /><path d="M3 4h3l2.5 12.4a2 2 0 0 0 2 1.6h8a2 2 0 0 0 2-1.4L22 8H6.5" /></svg>;
    case "bag":
      return <svg {...common}><path d="M5 7h14l-1 13a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 7Z" /><path d="M9 7V5a3 3 0 0 1 6 0v2" /></svg>;
    case "heart":
      return <svg {...common}><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1.1 1L12 21.2l7.8-7.8 1-1a5.5 5.5 0 0 0 0-7.8Z" /></svg>;
    case "share":
      return <svg {...common}><circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><path d="m8.6 13.5 6.8 4M15.4 6.5l-6.8 4" /></svg>;
    case "star":
      return <svg {...common}><path d="m12 2 3 7 7 .6-5.3 4.7 1.6 7-6.3-3.8L5.7 21.3l1.6-7L2 9.6 9 9l3-7Z" /></svg>;
    case "plus":
      return <svg {...common}><path d="M12 5v14M5 12h14" /></svg>;
    case "minus":
      return <svg {...common}><path d="M5 12h14" /></svg>;
    case "close":
      return <svg {...common}><path d="m18 6-12 12M6 6l12 12" /></svg>;
    case "check":
      return <svg {...common}><path d="m5 13 4 4 10-10" /></svg>;
    case "chevron-left":
      return <svg {...common}><path d="m15 18-6-6 6-6" /></svg>;
    case "chevron-right":
      return <svg {...common}><path d="m9 6 6 6-6 6" /></svg>;
    case "chevron-down":
      return <svg {...common}><path d="m6 9 6 6 6-6" /></svg>;
    case "chevron-up":
      return <svg {...common}><path d="m6 15 6-6 6 6" /></svg>;
    case "arrow-right":
      return <svg {...common}><path d="M5 12h14M13 5l7 7-7 7" /></svg>;
    case "arrow-left":
      return <svg {...common}><path d="M19 12H5M11 19l-7-7 7-7" /></svg>;
    case "back":
      return <svg {...common}><path d="M15 18l-6-6 6-6" /></svg>;
    case "clock":
      return <svg {...common}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>;
    case "bolt":
      return <svg {...common} fill="currentColor" stroke="none"><path d="M13 2 3 14h7l-1 8 10-12h-7l1-8Z" /></svg>;
    case "truck":
      return <svg {...common}><path d="M3 7h11v10H3zM14 10h4l3 3v4h-7z" /><circle cx="7" cy="18" r="2" /><circle cx="17" cy="18" r="2" /></svg>;
    case "store":
      return <svg {...common}><path d="M3 9 5 4h14l2 5" /><path d="M4 9v12h16V9" /><path d="M3 9a3 3 0 0 0 6 0 3 3 0 0 0 6 0 3 3 0 0 0 6 0" /></svg>;
    case "phone":
      return <svg {...common}><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6 19.8 19.8 0 0 1-3.1-8.7A2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .3 2 .6 2.9a2 2 0 0 1-.5 2.1L8 10a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2-.5c1 .3 1.9.5 3 .6a2 2 0 0 1 1.7 2Z" /></svg>;
    case "message":
      return <svg {...common}><path d="M21 15a2 2 0 0 1-2 2H8l-4 4V6a2 2 0 0 1 2-2h13a2 2 0 0 1 2 2Z" /></svg>;
    case "telegram":
      return <svg {...common} fill="currentColor" stroke="none"><path d="m21.3 3.3-18 6.9c-1.1.4-1 1.9 0 2.3l4.4 1.6 1.8 5.9c.2.6 1 1 1.5.5l2.6-2.5 4.9 3.7c.7.6 1.7.2 1.9-.7l3.1-14.7c.2-1-.7-1.9-1.7-1.5Zm-3 4.4L10 14l-.3 3.4 2-3.4 7.9-6.7c.3-.2.4.3.2.4Z" /></svg>;
    case "sms":
      return <svg {...common}><path d="M21 12a8 8 0 1 1-3.2-6.4L21 4l-1 3.5A8 8 0 0 1 21 12Z" /><path d="M8 11h.01M12 11h.01M16 11h.01" /></svg>;
    case "logout":
      return <svg {...common}><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><path d="m16 17 5-5-5-5" /><path d="M21 12H9" /></svg>;
    case "login":
      return <svg {...common}><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" /><polyline points="10 17 15 12 10 7" /><line x1="15" y1="12" x2="3" y2="12" /></svg>;
    case "trash":
      return <svg {...common}><path d="M3 6h18" /><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" /><path d="M10 11v6M14 11v6" /></svg>;
    case "edit":
      return <svg {...common}><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.4 2.6a2 2 0 1 1 2.8 2.8L12 14.6l-4 1 1-4 9.4-9Z" /></svg>;
    case "filter":
      return <svg {...common}><path d="M3 5h18M6 12h12M10 19h4" /></svg>;
    case "grid":
      return <svg {...common}><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></svg>;
    case "list":
      return <svg {...common}><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" /></svg>;
    case "map":
      return <svg {...common}><path d="M3 6v15l6-3 6 3 6-3V3l-6 3-6-3-6 3Z" /><path d="M9 3v15M15 6v15" /></svg>;
    case "home":
      return <svg {...common}><path d="m3 11 9-8 9 8v10a2 2 0 0 1-2 2h-4v-6h-6v6H5a2 2 0 0 1-2-2Z" /></svg>;
    case "orders":
      return <svg {...common}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" /><path d="M14 2v6h6" /><path d="M8 13h8M8 17h5" /></svg>;
    case "warning":
      return <svg {...common}><path d="M10.3 3.9 2 18a2 2 0 0 0 1.7 3h16.6a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" /><path d="M12 9v4M12 17h.01" /></svg>;
    case "info":
      return <svg {...common}><circle cx="12" cy="12" r="9" /><path d="M12 16v-4M12 8h.01" /></svg>;
    case "gift":
      return <svg {...common}><rect x="3" y="8" width="18" height="4" rx="1" /><path d="M12 8v14" /><path d="M19 12v9a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-9" /><path d="M7.5 8a2.5 2.5 0 0 1 0-5c2 0 4.5 3 4.5 5 0-2 2.5-5 4.5-5a2.5 2.5 0 0 1 0 5" /></svg>;
    case "coin":
      return <svg {...common}><circle cx="12" cy="12" r="9" /><path d="M9 9a3 3 0 0 1 6 0c0 1.5-1.5 2-3 3v1" /><path d="M12 16.5h.01" /></svg>;
    case "settings":
      return <svg {...common}><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z" /></svg>;
    case "headphones":
      return <svg {...common}><path d="M3 18v-6a9 9 0 0 1 18 0v6" /><path d="M21 19a2 2 0 0 1-2 2h-1v-6h3Zm-18 0a2 2 0 0 0 2 2h1v-6H3Z" /></svg>;
    case "help":
      return <svg {...common}><circle cx="12" cy="12" r="9" /><path d="M9.1 9a3 3 0 1 1 5.8 1c0 2-3 3-3 3" /><path d="M12 17h.01" /></svg>;
    case "mic-off":
      return <svg {...common}><path d="m2 2 20 20" /><path d="M9 9v3a3 3 0 0 0 5.1 2.1M15 9.3V6a3 3 0 0 0-6-.4" /><path d="M17 16a7 7 0 0 0 2-5" /><path d="M19 11v-1" /></svg>;
    case "camera":
      return <svg {...common}><path d="M23 7 17.5 7 16 4h-8l-1.5 3H3a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h18a2 2 0 0 0 2-2Z" /><circle cx="12" cy="13" r="4" /></svg>;
    case "photo":
      return <svg {...common}><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="9" cy="9" r="2" /><path d="m21 15-5-5L5 21" /></svg>;
    case "eye":
      return <svg {...common}><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" /><circle cx="12" cy="12" r="3" /></svg>;
    case "eye-off":
      return <svg {...common}><path d="M9.9 4.2A10 10 0 0 1 12 4c6.5 0 10 7 10 7a13.5 13.5 0 0 1-1.7 2.7M6.6 6.6A13.5 13.5 0 0 0 2 11s3.5 7 10 7c1.5 0 2.9-.4 4.1-1M2 2l20 20M9.9 9.9a3 3 0 0 0 4.2 4.2" /></svg>;
    case "card":
      return <svg {...common}><rect x="2" y="5" width="20" height="14" rx="3" /><path d="M2 10h20M6 15h3" /></svg>;
    case "cash":
      return <svg {...common}><rect x="2" y="6" width="20" height="12" rx="2" /><circle cx="12" cy="12" r="2.5" /><path d="M6 10v.01M18 14v.01" /></svg>;
    case "crosshair":
      return <svg {...common}><circle cx="12" cy="12" r="9" /><path d="M22 12h-4M6 12H2M12 2v4M12 22v-4" /></svg>;
  }
}
