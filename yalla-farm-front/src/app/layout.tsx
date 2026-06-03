import type { Metadata, Viewport } from "next";
import "./globals.css";
import { StoreProvider } from "@/app/providers/StoreProvider";

export const dynamic = "force-dynamic";

const runtimeConfigKeys = [
  "NEXT_PUBLIC_API_BASE_URL",
  "NEXT_PUBLIC_SIGNALR_UPDATES_HUB_URL",
  "NEXT_PUBLIC_SIGNALR_TELEGRAM_AUTH_HUB_URL",
  "NEXT_PUBLIC_YANDEX_MAPS_API_KEY",
] as const;

function getRuntimeConfigScript() {
  const runtimeConfig = Object.fromEntries(
    runtimeConfigKeys.map((key) => [key, process.env[key] ?? ""]),
  );

  return `window.__YALLA_PHARM_RUNTIME_CONFIG__ = ${JSON.stringify(runtimeConfig).replace(
    /</g,
    "\\u003c",
  )};`;
}

export const metadata: Metadata = {
  title: "Yalla Pharm | Pharmacy Dushanbe",
  description: "Онлайн-аптека Душанбе: доставка лекарств",
  icons: {
    icon: [
      { url: "/logo-icon.png?v=2", type: "image/png" },
    ],
    shortcut: "/logo-icon.png?v=2",
    apple: "/logo-icon.png?v=2",
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
        <script
          id="yalla-runtime-config"
          dangerouslySetInnerHTML={{ __html: getRuntimeConfigScript() }}
        />
        <link rel="preconnect" href="https://api-maps.yandex.ru" crossOrigin="anonymous" />
        <link rel="preconnect" href="https://platform.mahal.tj" crossOrigin="anonymous" />
      </head>
      <body>
        <StoreProvider>{children}</StoreProvider>
      </body>
    </html>
  );
}
