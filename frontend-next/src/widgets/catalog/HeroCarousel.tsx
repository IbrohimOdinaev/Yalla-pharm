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
    <section className="flex snap-x snap-mandatory gap-4 overflow-x-auto pb-2">
      {slides.map((slide) => (
        <article
          key={slide.title}
          className={`min-w-[85%] snap-center rounded-2xl bg-gradient-to-br ${slide.gradient} p-6 text-white shadow-glass`}
        >
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] opacity-80">Health First</p>
          <h2 className="mt-3 text-2xl font-extrabold leading-tight">{slide.title}</h2>
          <p className="mt-2 text-sm opacity-90">{slide.subtitle}</p>
        </article>
      ))}
    </section>
  );
}
