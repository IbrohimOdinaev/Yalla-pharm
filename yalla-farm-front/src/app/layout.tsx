import type { Metadata, Viewport } from "next";
import "./globals.css";
import { StoreProvider } from "@/app/providers/StoreProvider";

export const metadata: Metadata = {
  title: "Yalla Pharm | Pharmacy Dushanbe",
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
  // viewport-fit=cover is what makes env(safe-area-inset-*) become
  // non-zero on iOS — required for safe-bottom utility to push content
  // above the home indicator and Safari's retractable bottom toolbar.
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru">
      <head>
        {/* Warm up the TCP+TLS connection to Yandex Maps' CDNs while the
            user is still reading the page. The SDK loader, the tile
            servers and the static assets each live on a separate host;
            preconnect to all three roughly halves first-paint of the
            address-picker map (TLS handshake alone was ~0.9s on cold). */}
        <link rel="preconnect" href="https://api-maps.yandex.ru" crossOrigin="anonymous" />
        <link rel="preconnect" href="https://yastatic.net" crossOrigin="anonymous" />
        <link rel="preconnect" href="https://core-renderer-tiles.maps.yandex.net" crossOrigin="anonymous" />
        <link rel="dns-prefetch" href="https://suggest-maps.yandex.ru" />
      </head>
      <body>
        <StoreProvider>{children}</StoreProvider>
      </body>
    </html>
  );
}
