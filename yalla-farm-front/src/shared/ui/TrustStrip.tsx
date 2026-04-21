import { Icon, type IconName } from "./Icon";

type Item = { icon: IconName; text: string };

const DEFAULTS: Item[] = [
  { icon: "bolt", text: "30–45 мин" },
  { icon: "pharmacy", text: "120+ аптек" },
  { icon: "bag", text: "5 800 товаров" },
  { icon: "card", text: "Оплата при получении" },
];

// Yandex-style trust chips: neutral grey background, thin border, compact.
export function TrustStrip({ items = DEFAULTS }: { items?: Item[] }) {
  return (
    <div className="flex gap-2 overflow-x-auto scrollbar-hide scroll-touch -mx-3 px-3 pb-1">
      {items.map((it, i) => (
        <span
          key={i}
          className="inline-flex flex-shrink-0 items-center gap-1.5 rounded-full bg-surface-container px-3 py-1.5 text-[11px] font-semibold text-on-surface"
        >
          <Icon name={it.icon} size={12} className="text-primary" />
          {it.text}
        </span>
      ))}
    </div>
  );
}
