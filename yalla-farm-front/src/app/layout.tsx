import type { Metadata, Viewport } from "next";
import "./globals.css";
import { StoreProvider } from "@/app/providers/StoreProvider";

export const metadata: Metadata = {
  title: "Yalla Farm | Pharmacy Dushanbe",
  description: "Онлайн-аптека Душанбе: доставка лекарств",
  icons: {
    icon: "/favicon.ico",
    apple: "/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
  modal,
}: {
  children: React.ReactNode;
  modal: React.ReactNode;
}) {
  return (
    <html lang="ru">
      <body>
        <StoreProvider>
          {children}
          {modal}
        </StoreProvider>
      </body>
    </html>
  );
}
