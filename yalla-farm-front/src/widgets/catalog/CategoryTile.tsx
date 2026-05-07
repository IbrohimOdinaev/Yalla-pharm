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
  onClick?: () => void;
};

// Yandex-Аптеки proportions: image dominates the upper portion of the
// tile, label sits inside the card at the bottom. Single rounded box
// (no external caption) so the whole thing reads as one card. The neutral
// `image-backdrop` warm-gray matches Yandex's tile colour.
export function CategoryTile({ icon, palette, label, image, onClick }: Props) {
  const p = palettes[palette];
  const tileSurface = image
    ? "bg-image-backdrop"
    : `${p.bg} ${p.fg}`;
  return (
    <button
      type="button"
      onClick={onClick}
      className="group transition active:scale-95"
    >
      <span
        className={`flex h-[129px] w-[110px] flex-col overflow-hidden rounded-2xl ${tileSurface} transition group-hover:scale-105 sm:h-[152px] sm:w-[124px] lg:h-[175px] lg:w-[143px]`}
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
