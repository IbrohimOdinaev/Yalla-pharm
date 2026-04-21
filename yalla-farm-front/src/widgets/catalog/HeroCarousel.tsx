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

// Yandex-style promo banner row — flat, rounded, big heading, compact CTA.
export function HeroCarousel() {
  return (
    <section className="flex snap-x snap-mandatory gap-3 overflow-x-auto scrollbar-hide scroll-touch -mx-3 px-3 pb-1 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
      {slides.map((slide) => (
        <article
          key={slide.title}
          className={`relative min-w-[85%] snap-center overflow-hidden rounded-3xl p-5 sm:min-w-[58%] lg:min-w-[40%] ${slide.bg} ${slide.textOn}`}
        >
          {/* Decorative blob */}
          <span aria-hidden className="pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full bg-white/10" />
          <span aria-hidden className="pointer-events-none absolute right-8 -bottom-8 h-24 w-24 rounded-full bg-white/15" />

          <div className="relative flex h-full flex-col justify-between gap-4">
            <span className="inline-flex w-fit items-center rounded-full bg-white/20 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider backdrop-blur-sm">
              {slide.badge}
            </span>

            <div>
              <h2 className="font-display text-xl font-extrabold leading-tight sm:text-2xl lg:text-3xl">
                {slide.title}
              </h2>
              <p className="mt-1.5 text-sm opacity-90 sm:text-base">{slide.subtitle}</p>
            </div>

            <button
              type="button"
              className={`inline-flex w-fit items-center gap-1.5 rounded-full bg-white/95 px-4 py-2 text-xs font-extrabold transition hover:bg-white ${slide.textOn === "text-white" ? "text-on-surface" : "text-on-surface"}`}
            >
              Подробнее →
            </button>
          </div>
        </article>
      ))}
    </section>
  );
}
