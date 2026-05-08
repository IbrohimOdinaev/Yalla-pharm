import { CategoryIcon, type CategoryIconKey } from "./CategoryIcon";

export type CategoryTilePalette =
  | "mint"
  | "coral"
  | "sky"
  | "lilac"
  | "sun"
  | "rose"
  | "peach"
  | "sage";

// Pastel tile + matching ink — both sides drawn from the unified Tailwind
// palette so every category feels like a sibling, not a one-off sticker.
const palettes: Record<CategoryTilePalette, { bg: string; fg: string }> = {
  mint:  { bg: "bg-accent-mint",  fg: "text-accent-mint-ink" },
  coral: { bg: "bg-accent-coral", fg: "text-accent-coral-ink" },
  sky:   { bg: "bg-accent-sky",   fg: "text-accent-sky-ink" },
  lilac: { bg: "bg-accent-lilac", fg: "text-accent-lilac-ink" },
  sun:   { bg: "bg-accent-sun",   fg: "text-accent-sun-ink" },
  rose:  { bg: "bg-accent-rose",  fg: "text-accent-rose-ink" },
  peach: { bg: "bg-accent-peach", fg: "text-accent-peach-ink" },
  sage:  { bg: "bg-accent-sage",  fg: "text-accent-sage-ink" },
};

type Props = {
  icon: CategoryIconKey;
  palette: CategoryTilePalette;
  label: string;
  /** Optional photographic image — when set, displayed full-bleed inside
   *  the tile and replaces the SVG icon. Pastel background still shows
   *  while the image is loading or if it fails. */
  image?: string;
  /** "default" — image/icon centered + label at the bottom (Yandex tile
   *  pattern). "arrow" — minimalist variant: label at the top-left and
   *  a round arrow CTA in the bottom-right, no image. Used for the
   *  "Все категории" anchor tile so it reads as a clear "open the full
   *  list" affordance instead of yet another category. */
  variant?: "default" | "arrow";
  onClick?: () => void;
};

// Yandex-Аптеки proportions: image dominates the upper portion of the
// tile, label sits inside the card at the bottom. Single rounded box
// (no external caption) so the whole thing reads as one card. The neutral
// `image-backdrop` warm-gray matches Yandex's tile colour.
export function CategoryTile({ icon, palette, label, image, variant = "default", onClick }: Props) {
  const p = palettes[palette];

  if (variant === "arrow") {
    return (
      <button
        type="button"
        onClick={onClick}
        className="group transition active:scale-95"
        aria-label={label}
      >
        {/* No scale-on-hover — the user found the bounce distracting once
            the rail had multiple tiles. Darken the warm-grey backdrop on
            hover instead so the affordance still reads. Arrow on TOP and
            label at the BOTTOM (mirror of the photographic tiles' layout)
            to keep the rail visually balanced when this card sits next
            to image-led tiles. */}
        <span className="flex h-[129px] w-[110px] flex-col justify-between overflow-hidden rounded-2xl bg-image-backdrop p-3 transition group-hover:bg-surface-container-high sm:h-[152px] sm:w-[124px] sm:p-4 lg:h-[175px] lg:w-[143px]">
          <span className="flex justify-end">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-surface text-on-surface shadow-card transition group-hover:bg-on-surface group-hover:text-surface sm:h-10 sm:w-10">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="5" y1="12" x2="19" y2="12" />
                <polyline points="12 5 19 12 12 19" />
              </svg>
            </span>
          </span>
          <span className="text-left text-[12px] font-extrabold leading-tight text-on-surface sm:text-sm lg:text-[15px]">
            {label}
          </span>
        </span>
      </button>
    );
  }

  const tileSurface = image
    ? "bg-image-backdrop"
    : `${p.bg} ${p.fg}`;
  // Hover: darken to surface-container-high for image tiles (warm-grey
  // matches the backdrop family); for icon-only pastel tiles the pastel
  // already reads as a hovered surface, so no extra change needed.
  const hoverSurface = image ? "group-hover:bg-surface-container-high" : "";
  return (
    <button
      type="button"
      onClick={onClick}
      className="group transition active:scale-95"
    >
      <span
        className={`flex h-[129px] w-[110px] flex-col overflow-hidden rounded-2xl ${tileSurface} ${hoverSurface} transition sm:h-[152px] sm:w-[124px] lg:h-[175px] lg:w-[143px]`}
      >
        {/* Image area — takes the upper ~70% of the tile, centered with
            generous padding so the artwork has room to breathe (Yandex
            keeps the actual product photo small relative to the card). */}
        <span className={`flex flex-1 items-center justify-center ${image ? "p-3 sm:p-4" : "p-2 sm:p-3"}`}>
          {image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={image}
              alt=""
              loading="lazy"
              decoding="async"
              className="h-full w-full object-contain mix-blend-multiply"
            />
          ) : (
            <CategoryIcon name={icon} className="h-full w-full" />
          )}
        </span>
        {/* Label sits flush to the bottom edge inside the card — separate
            from the image area but still part of the same rounded box. */}
        <span className="block px-2.5 pb-2.5 text-left text-[11px] font-bold leading-tight text-on-surface sm:px-3 sm:pb-3 sm:text-xs lg:text-[13px]">
          {label}
        </span>
      </span>
    </button>
  );
}
