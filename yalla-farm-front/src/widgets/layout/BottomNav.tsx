"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  { href: "/", label: "Каталог" },
  { href: "/cart", label: "Корзина" },
  { href: "/orders", label: "Заказы" },
  { href: "/profile", label: "Профиль" }
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-surface-container-high bg-surface/95 backdrop-blur-xl">
      <div className="mx-auto grid h-16 max-w-5xl grid-cols-4 gap-2 px-4 py-2">
        {items.map((item) => {
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`rounded-xl px-2 py-2 text-center text-xs font-semibold transition ${
                active ? "bg-primary text-white" : "bg-surface-container-low text-on-surface-variant hover:bg-surface-container-high"
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
