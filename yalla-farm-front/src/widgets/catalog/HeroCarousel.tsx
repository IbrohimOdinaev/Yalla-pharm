const slides = [
  {
    title: "Витамины для иммунитета",
    subtitle: "Поддержите организм в сезон простуд",
    gradient: "from-primary to-primary-container"
  },
  {
    title: "Антиаллергия",
    subtitle: "Лучшие препараты для весеннего периода",
    gradient: "from-secondary to-emerald-400"
  }
];

export function HeroCarousel() {
  return (
    <section className="flex snap-x snap-mandatory gap-2 xs:gap-3 sm:gap-4 overflow-x-auto pb-2">
      {slides.map((slide) => (
        <article
          key={slide.title}
          className={`min-w-[92%] xs:min-w-[88%] snap-center rounded-xl xs:rounded-2xl bg-gradient-to-br ${slide.gradient} p-3 xs:p-4 sm:p-6 text-white shadow-glass`}
        >
          <p className="text-[8px] xs:text-[10px] font-bold uppercase tracking-[0.1em] xs:tracking-[0.15em] opacity-80">Health First</p>
          <h2 className="mt-1.5 xs:mt-2 text-lg xs:text-xl sm:text-2xl font-extrabold leading-tight">{slide.title}</h2>
          <p className="mt-1 xs:mt-1.5 text-[10px] xs:text-xs sm:text-sm opacity-90">{slide.subtitle}</p>
        </article>
      ))}
    </section>
  );
}
