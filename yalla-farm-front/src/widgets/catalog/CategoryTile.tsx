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

// Yandex-style: coloured square tile + caption below. Sized big enough to
// let the multi-colour illustrations breathe — details on thermometer, flower,
// lungs etc. are lost below ~56px icon size. When `image` is provided, the
// tile renders a real photo instead of the vector icon.
export function CategoryTile({ icon, palette, label, image, onClick }: Props) {
  const p = palettes[palette];
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex flex-col items-center gap-2 transition active:scale-95"
    >
      <span
        className={`flex h-[80px] w-[80px] items-center justify-center overflow-hidden rounded-2xl ${image ? "" : "p-3"} ${p.bg} ${p.fg} transition group-hover:scale-105 sm:h-[92px] sm:w-[92px] ${image ? "" : "sm:p-3.5"} lg:h-[104px] lg:w-[104px]`}
      >
        {image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={image}
            alt=""
            loading="lazy"
            decoding="async"
            className="h-full w-full object-cover"
          />
        ) : (
          <CategoryIcon name={icon} className="h-full w-full" />
        )}
      </span>
      <span className="max-w-[104px] text-center text-[11px] font-semibold leading-tight text-on-surface sm:text-xs">
        {label}
      </span>
    </button>
  );
}
