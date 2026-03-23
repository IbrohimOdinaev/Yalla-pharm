import type { Metadata } from "next";
import "./globals.css";
import { StoreProvider } from "@/app/providers/StoreProvider";

export const metadata: Metadata = {
  title: "Yalla Farm | Pharmacy Dushanbe",
  description: "Новый frontend Yalla Farm: Next.js + Tailwind + Zustand + Redux + SignalR"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru">
      <body>
        <StoreProvider>{children}</StoreProvider>
      </body>
    </html>
  );
}
