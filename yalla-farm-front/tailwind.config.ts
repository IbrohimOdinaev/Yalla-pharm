import type { Config } from "tailwindcss";

/**
 * Single-source-of-truth palette for the whole app.
 *
 * Design rules
 * ─────────────
 * 1. **One brand (green)**, **one CTA (yellow)**, **one danger (red)**,
 *    **one info (blue)**, **one warning (amber)**. Nothing else mixes.
 * 2. Every semantic colour has a **-container** (stronger, hover/emphasis)
 *    and **-soft** (pastel fill for chips/backgrounds).
 * 3. The 8 accent pastels share the same HSL lightness/saturation window so
 *    category tiles and decorative chips feel like a family.
 * 4. Surface greys are warm near-neutrals tuned to play nicely with the
 *    warm-yellow CTA without competing with it.
 */
const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    screens: {
      // Lowered `sm` from the Tailwind default 640 to 540: the layout was
      // too monolithic between 375 and 640 (phone landscape / narrow tablets
      // looked identical to small phones). 540 lets cart pills go inline,
      // grids open up to 3 cols, and pharmacy banners hit their wider size
      // earlier while still leaving a clear visual gap to `lg` (1024).
      xs: "375px",
      sm: "540px",
      md: "768px",
      lg: "1024px",
      xl: "1280px",
      "2xl": "1536px",
    },
    extend: {
      colors: {
        // ── Brand green (logo, status, secondary UI, links) ───────────────
        primary: "#0E8B60",
        "primary-container": "#13A271",
        "primary-soft": "#E1F0E9",

        // ── Action red (cart button on products, favourites, sale prices) ─
        secondary: "#E94A33",
        "secondary-container": "#FF6145",
        "secondary-soft": "#FCE0DB",

        // ── Info blue (links, JURA status, generic info) ──────────────────
        tertiary: "#2F80ED",
        "tertiary-soft": "#DDE9FA",

        // ── Yandex-Plus yellow (primary CTA buttons) ──────────────────────
        accent: "#FFDB4D",
        "accent-dark": "#F5CC20",
        "accent-soft": "#FFF1C7",

        // ── Amber warning (pending payments, partial stock, soft alerts) ──
        warning: "#B77400",
        "warning-container": "#FFC24D",
        "warning-soft": "#FFE8C2",

        // ── Telegram brand (buttons, link chips) ──────────────────────────
        telegram: "#229ED9",
        "telegram-dark": "#1C8CC4",
        "telegram-soft": "#DDEEFB",

        // ── Surfaces (warm near-neutral) ──────────────────────────────────
        surface: "#FFFFFF",
        "surface-container": "#F2F4F2",
        "surface-container-low": "#F8FAF8",
        "surface-container-high": "#E9ECE9",
        "surface-container-highest": "#DDE1DE",
        "surface-container-lowest": "#FFFFFF",

        // ── Text & strokes ────────────────────────────────────────────────
        "on-surface": "#1A1C1B",
        "on-surface-variant": "#6F7572",
        outline: "#D8DCD9",

        // ── Category pastels — same HSL family (L≈92%, S≈60%) ─────────────
        "accent-mint":  "#DFF3E7",   // green
        "accent-coral": "#FCE1D9",   // red-orange
        "accent-sky":   "#DCEBF6",   // blue
        "accent-lilac": "#E8E2F3",   // purple
        "accent-sun":   "#FBEDC9",   // yellow
        "accent-rose":  "#F9DFE7",   // pink
        "accent-peach": "#FCE6D7",   // peach
        "accent-sage":  "#E4EEDC",   // olive

        // ── Category ink colours — matched saturation/lightness (L≈45%) ────
        "accent-mint-ink":  "#0E8B60",
        "accent-coral-ink": "#C04F3A",
        "accent-sky-ink":   "#2F80ED",
        "accent-lilac-ink": "#6C57C5",
        "accent-sun-ink":   "#A67A0C",
        "accent-rose-ink":  "#BF4A7A",
        "accent-peach-ink": "#BE6330",
        "accent-sage-ink":  "#5B8648",
      },
      boxShadow: {
        glass: "0 2px 12px rgba(26, 28, 27, 0.04)",
        card: "0 1px 3px rgba(26, 28, 27, 0.04)",
        float: "0 4px 16px rgba(26, 28, 27, 0.08)",
      },
      borderRadius: {
        xl2: "1rem",
      },
      fontFamily: {
        sans: ["Inter", "YS Text", "system-ui", "sans-serif"],
        display: ["Manrope", "Inter", "YS Display", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
