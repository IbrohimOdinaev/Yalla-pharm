import Link from "next/link";
import { Icon } from "@/shared/ui";

export function Footer() {
  return (
    <footer className="mt-12 border-t border-outline/70 bg-surface-container-low">
      <div className="mx-auto w-[90%] py-10">
        <div className="grid gap-8 sm:grid-cols-2 sm:gap-10 lg:grid-cols-5">
          {/* Brand */}
          <div className="sm:col-span-2">
            <div className="flex items-center gap-2.5">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-white font-display font-extrabold">
                Y
              </span>
              <span className="font-display text-lg font-extrabold text-on-surface">Yalla Pharm</span>
            </div>
            <p className="mt-3 max-w-sm text-sm leading-relaxed text-on-surface-variant">
              Онлайн-аптека Душанбе. Тысячи лекарств из самых крупных аптек с доставкой за 30–45 минут.
            </p>
            <p className="mt-3 text-xs font-bold uppercase tracking-wider text-on-surface-variant">
              Работаем по городу Душанбе
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <a
                href="https://t.me/yalla_tj"
                target="_blank"
                rel="noreferrer"
                className="flex h-10 w-10 items-center justify-center rounded-full bg-surface-container text-telegram transition hover:bg-surface-container-high"
                aria-label="Telegram @yalla_tj"
                title="Telegram-канал поддержки"
              >
                <Icon name="telegram" size={16} />
              </a>
              <a
                href="https://www.instagram.com/yalla.tj?igsh=dThsNHhtMHY1YXlt"
                target="_blank"
                rel="noreferrer"
                className="flex h-10 w-10 items-center justify-center rounded-full bg-surface-container text-on-surface transition hover:bg-surface-container-high"
                aria-label="Instagram"
                title="Instagram"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
                  <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
                  <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
                </svg>
              </a>
              <a
                href="https://www.linkedin.com/company/yalla-1?trk=public_profile_topcard-current-company"
                target="_blank"
                rel="noreferrer"
                className="flex h-10 w-10 items-center justify-center rounded-full bg-surface-container text-on-surface transition hover:bg-surface-container-high"
                aria-label="LinkedIn"
                title="LinkedIn"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-4 0v7h-4v-7a6 6 0 0 1 6-6z" />
                  <rect x="2" y="9" width="4" height="12" />
                  <circle cx="4" cy="4" r="2" />
                </svg>
              </a>
              <a
                href="mailto:info@yalla.tj"
                className="flex h-10 w-10 items-center justify-center rounded-full bg-surface-container text-on-surface transition hover:bg-surface-container-high"
                aria-label="Email info@yalla.tj"
                title="info@yalla.tj"
              >
                <Icon name="message" size={16} />
              </a>
              <span className="flex h-10 items-center gap-1.5 rounded-full bg-accent px-3 text-xs font-extrabold text-on-surface">
                <Icon name="bolt" size={12} />
                30-45 мин
              </span>
            </div>
          </div>

          <FooterColumn title="Каталог">
            <FooterLink href="/">Все товары</FooterLink>
            <FooterLink href="/pharmacies/map">Карта аптек</FooterLink>
            <FooterLink href="/?search=">Поиск</FooterLink>
          </FooterColumn>

          <FooterColumn title="Аккаунт">
            <FooterLink href="/orders">Мои заказы</FooterLink>
            <FooterLink href="/profile">Профиль</FooterLink>
            <FooterLink href="/login">Вход</FooterLink>
          </FooterColumn>

          <FooterColumn title="Контакты">
            <li className="text-sm text-on-surface-variant">Душанбе, Таджикистан</li>
            <li>
              <a
                href="mailto:info@yalla.tj"
                className="text-sm text-on-surface-variant transition hover:text-primary"
              >
                info@yalla.tj
              </a>
            </li>
            <li>
              <a
                href="https://t.me/yalla_tj"
                target="_blank"
                rel="noreferrer"
                className="text-sm text-on-surface-variant transition hover:text-primary"
              >
                Telegram: @yalla_tj
              </a>
            </li>
          </FooterColumn>
        </div>

        <div className="mt-10 flex flex-col gap-2 border-t border-outline/50 pt-6 text-xs text-on-surface-variant sm:flex-row sm:items-center sm:justify-between">
          <span>© {new Date().getFullYear()} Yalla Pharm</span>
          <span>Берегите здоровье — консультируйтесь с врачом перед приёмом лекарств</span>
        </div>
      </div>
    </footer>
  );
}

function FooterColumn({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h4 className="font-display text-sm font-extrabold text-on-surface">{title}</h4>
      <ul className="mt-3 space-y-2">{children}</ul>
    </div>
  );
}

function FooterLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <li>
      <Link href={href} className="text-sm text-on-surface-variant transition hover:text-primary">
        {children}
      </Link>
    </li>
  );
}
