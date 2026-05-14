import Link from "next/link";
import { Icon } from "@/shared/ui";

/* Brand-coloured social glyphs. Inline SVGs (no external sprite) so the
   footer stays self-contained and the colours match each platform's
   official identity instead of falling back to a single accent tone. */
function TelegramGlyph() {
  return (
    <svg width="20" height="20" viewBox="0 0 240 240" aria-hidden="true">
      <circle cx="120" cy="120" r="120" fill="#229ED9" />
      <path
        d="M53 116.7l122.4-47.2c5.7-2.1 10.7 1.4 8.9 10.1l-20.8 98.1c-1.5 7-5.7 8.7-11.5 5.4l-31.8-23.5-15.3 14.8c-1.7 1.7-3.1 3.1-6.4 3.1l2.3-32.4 59-53.3c2.6-2.3-.6-3.5-3.9-1.3l-72.9 45.9-31.4-9.8c-6.8-2.2-7-7-1.6-10.4z"
        fill="#fff"
      />
    </svg>
  );
}
function InstagramGlyph() {
  return (
    <svg width="20" height="20" viewBox="0 0 240 240" aria-hidden="true">
      <defs>
        <radialGradient id="ig-grad" cx="30%" cy="107%" r="150%">
          <stop offset="0%" stopColor="#FDF497" />
          <stop offset="5%" stopColor="#FDF497" />
          <stop offset="45%" stopColor="#FD5949" />
          <stop offset="60%" stopColor="#D6249F" />
          <stop offset="90%" stopColor="#285AEB" />
        </radialGradient>
      </defs>
      <rect width="240" height="240" rx="56" fill="url(#ig-grad)" />
      <path
        d="M120 70c-13.6 0-15.3.06-20.6.3-5.3.24-9 1.1-12.1 2.3-3.3 1.3-6 3-8.8 5.8-2.7 2.7-4.5 5.5-5.7 8.8-1.3 3.2-2.1 6.8-2.4 12.1-.2 5.3-.3 7-.3 20.6s.06 15.3.3 20.6c.24 5.3 1.1 8.9 2.3 12.1 1.3 3.3 3 6 5.8 8.8 2.7 2.7 5.5 4.5 8.8 5.7 3.2 1.3 6.8 2.1 12.1 2.4 5.3.2 7 .3 20.6.3s15.3-.06 20.6-.3c5.3-.24 8.9-1.1 12.1-2.3 3.3-1.3 6-3 8.8-5.8 2.7-2.7 4.5-5.5 5.7-8.8 1.2-3.2 2.1-6.8 2.4-12.1.2-5.3.3-7 .3-20.6s-.06-15.3-.3-20.6c-.24-5.3-1.1-9-2.3-12.1-1.3-3.3-3-6-5.8-8.8-2.7-2.7-5.5-4.5-8.8-5.7-3.2-1.3-6.8-2.1-12.1-2.4-5.3-.2-7-.3-20.6-.3zm0 9c13.4 0 15 .06 20.2.3 4.9.22 7.5 1 9.3 1.7 2.3.9 4 2 5.7 3.7 1.7 1.7 2.8 3.4 3.7 5.7.7 1.7 1.5 4.4 1.7 9.3.24 5.3.3 6.8.3 20.2s-.06 15-.3 20.2c-.22 4.9-1 7.5-1.7 9.3-.9 2.3-2 4-3.7 5.7-1.7 1.7-3.4 2.8-5.7 3.7-1.7.7-4.4 1.5-9.3 1.7-5.3.24-6.8.3-20.2.3s-15-.06-20.2-.3c-4.9-.22-7.5-1-9.3-1.7-2.3-.9-4-2-5.7-3.7-1.7-1.7-2.8-3.4-3.7-5.7-.7-1.7-1.5-4.4-1.7-9.3-.24-5.3-.3-6.8-.3-20.2s.06-15 .3-20.2c.22-4.9 1-7.5 1.7-9.3.9-2.3 2-4 3.7-5.7 1.7-1.7 3.4-2.8 5.7-3.7 1.7-.7 4.4-1.5 9.3-1.7 5.3-.24 6.8-.3 20.2-.3zm0 15.4c-14.1 0-25.6 11.4-25.6 25.6s11.5 25.6 25.6 25.6 25.6-11.4 25.6-25.6-11.5-25.6-25.6-25.6zm0 42.2a16.7 16.7 0 1 1 0-33.3 16.7 16.7 0 0 1 0 33.3zm32.6-43.2a6 6 0 1 1-12 0 6 6 0 0 1 12 0z"
        fill="#fff"
      />
    </svg>
  );
}
function LinkedInGlyph() {
  return (
    <svg width="20" height="20" viewBox="0 0 240 240" aria-hidden="true">
      <rect width="240" height="240" rx="32" fill="#0A66C2" />
      <path
        d="M82 96h-22v100h22V96zm-11-10c7.7 0 14-6.3 14-14s-6.3-14-14-14-14 6.3-14 14 6.3 14 14 14zm114 60c0-19-10-30-26-30-12 0-18 6-21 12v-10h-22v100h22v-58c0-7 1-15 11-15 9 0 11 8 11 15v58h25v-72z"
        fill="#fff"
      />
    </svg>
  );
}
function MailGlyph() {
  return (
    <svg width="20" height="20" viewBox="0 0 240 240" aria-hidden="true">
      <rect width="240" height="240" rx="32" fill="#0E8B60" />
      <path
        d="M60 80h120c5.5 0 10 4.5 10 10v60c0 5.5-4.5 10-10 10H60c-5.5 0-10-4.5-10-10V90c0-5.5 4.5-10 10-10zm0 12v6.5l60 36.5 60-36.5V92H60zm120 21.5l-56 34a8 8 0 0 1-8 0l-56-34V148h120v-34.5z"
        fill="#fff"
      />
    </svg>
  );
}

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
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <a
                href="https://t.me/yalla_tj"
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-10 w-10 items-center justify-center rounded-full transition active:scale-95 hover:scale-105"
                aria-label="Telegram @yalla_tj"
                title="Telegram-канал поддержки"
              >
                <TelegramGlyph />
              </a>
              <a
                href="https://www.instagram.com/yalla.tj?igsh=dThsNHhtMHY1YXlt"
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-10 w-10 items-center justify-center rounded-full transition active:scale-95 hover:scale-105"
                aria-label="Instagram"
                title="Instagram"
              >
                <InstagramGlyph />
              </a>
              <a
                href="https://www.linkedin.com/company/yalla-1?trk=public_profile_topcard-current-company"
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-10 w-10 items-center justify-center rounded-full transition active:scale-95 hover:scale-105"
                aria-label="LinkedIn"
                title="LinkedIn"
              >
                <LinkedInGlyph />
              </a>
              <a
                href="mailto:info@yalla.tj"
                className="inline-flex h-10 w-10 items-center justify-center rounded-full transition active:scale-95 hover:scale-105"
                aria-label="Email info@yalla.tj"
                title="info@yalla.tj"
              >
                <MailGlyph />
              </a>
              <span className="ml-1 flex h-10 items-center gap-1.5 rounded-full bg-accent px-3 text-xs font-extrabold text-on-surface">
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
                className="text-sm text-on-surface-variant transition active:scale-95 hover:text-primary"
              >
                info@yalla.tj
              </a>
            </li>
            <li>
              <a
                href="https://t.me/yalla_tj"
                target="_blank"
                rel="noreferrer"
                className="text-sm text-on-surface-variant transition active:scale-95 hover:text-primary"
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
      <Link href={href} className="text-sm text-on-surface-variant transition active:scale-95 hover:text-primary">
        {children}
      </Link>
    </li>
  );
}
