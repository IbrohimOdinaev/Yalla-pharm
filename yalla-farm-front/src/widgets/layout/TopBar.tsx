import Link from "next/link";

type TopBarProps = {
  title: string;
  location?: string;
  backHref?: string;
};

export function TopBar({ title, location = "Dushanbe, RT", backHref }: TopBarProps) {
  return (
    <header className="sticky top-0 z-40 bg-surface/90 backdrop-blur-xl border-b border-surface-container-high">
      <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4">
        <div className="flex items-center gap-3">
          {backHref ? (
            <Link href={backHref} className="rounded-full bg-surface-container-low px-3 py-2 text-primary transition hover:bg-surface-container-high">
              Назад
            </Link>
          ) : null}
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-on-surface-variant">{location}</p>
            <h1 className="text-lg font-bold text-primary">{title}</h1>
          </div>
        </div>
        <div className="rounded-full bg-tertiary px-3 py-1 text-xs font-bold text-white">Душанбе</div>
      </div>
    </header>
  );
}
