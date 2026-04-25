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
              <span className="font-display text-lg font-extrabold text-on-surface">Yalla Farm</span>
            </div>
            <p className="mt-3 max-w-sm text-sm leading-relaxed text-on-surface-variant">
              Онлайн-аптека Душанбе. Тысячи лекарств из 120+ аптек с доставкой за 30–45 минут.
            </p>
            <div className="mt-4 flex gap-2">
              <a
                href="tel:+992000000000"
                className="flex h-10 w-10 items-center justify-center rounded-full bg-surface-container text-on-surface transition hover:bg-surface-container-high"
                aria-label="Позвонить"
              >
                <Icon name="phone" size={16} />
              </a>
              <a
                href="https://t.me/yallafarm"
                target="_blank"
                rel="noreferrer"
                className="flex h-10 w-10 items-center justify-center rounded-full bg-surface-container text-telegram transition hover:bg-surface-container-high"
                aria-label="Telegram"
              >
                <Icon name="telegram" size={16} />
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
                href="mailto:support@yalla-farm.tj"
                className="text-sm text-on-surface-variant transition hover:text-primary"
              >
                support@yalla-farm.tj
              </a>
            </li>
            <li>
              <a
                href="tel:+992000000000"
                className="text-sm text-on-surface-variant transition hover:text-primary"
              >
                +992 (000) 00-00-00
              </a>
            </li>
          </FooterColumn>
        </div>

        <div className="mt-10 flex flex-col gap-2 border-t border-outline/50 pt-6 text-xs text-on-surface-variant sm:flex-row sm:items-center sm:justify-between">
          <span>© {new Date().getFullYear()} Yalla Farm</span>
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
