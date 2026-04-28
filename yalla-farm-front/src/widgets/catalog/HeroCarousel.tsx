const slides = [
  {
    title: "Витамины для иммунитета",
    subtitle: "Скидки до −30%",
    badge: "Health",
    bg: "bg-primary",
    textOn: "text-white",
  },
  {
    title: "Весенняя антиаллергия",
    subtitle: "Лучшие препараты сезона",
    badge: "Сезон",
    bg: "bg-tertiary",
    textOn: "text-white",
  },
  {
    title: "Доставка 30–45 минут",
    subtitle: "По всему Душанбе",
    badge: "Yalla+",
    bg: "bg-accent",
    textOn: "text-on-surface",
  },
];

// Compact promo banner row. Drawn small enough that it never out-sizes the
// quick-category tiles or rails — banners are accent, not the main feed.
export function HeroCarousel() {
  return (
    <section className="flex snap-x snap-mandatory gap-2 overflow-x-auto scrollbar-hide scroll-touch -mx-3 px-3 pb-1 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
      {slides.map((slide) => (
        <article
          key={slide.title}
          className={`relative min-w-[55%] snap-center overflow-hidden rounded-xl p-2 sm:min-w-[32%] sm:p-2.5 lg:min-w-[22%] ${slide.bg} ${slide.textOn}`}
        >
          {/* Decorative blob */}
          <span aria-hidden className="pointer-events-none absolute -right-6 -top-6 h-16 w-16 rounded-full bg-white/10" />
          <span aria-hidden className="pointer-events-none absolute right-2 -bottom-2 h-9 w-9 rounded-full bg-white/15" />

          <div className="relative flex h-full flex-col justify-between gap-1.5">
            <span className="inline-flex w-fit items-center rounded-full bg-white/20 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider backdrop-blur-sm">
              {slide.badge}
            </span>

            <div>
              <h2 className="font-display text-[11px] font-extrabold leading-tight sm:text-xs lg:text-sm">
                {slide.title}
              </h2>
              <p className="mt-0.5 text-[9px] opacity-90 sm:text-[10px]">{slide.subtitle}</p>
            </div>

            <button
              type="button"
              className="inline-flex w-fit items-center gap-1 rounded-full bg-white/95 px-2 py-0.5 text-[9px] font-extrabold text-on-surface transition hover:bg-white"
            >
              Подробнее →
            </button>
          </div>
        </article>
      ))}
    </section>
  );
}
