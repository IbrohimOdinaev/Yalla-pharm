import type { Metadata, Viewport } from "next";
import "./globals.css";
import { StoreProvider } from "@/app/providers/StoreProvider";
import { buildStructuredData, getSiteUrl, siteSeo } from "@/shared/seo/site";

export const dynamic = "force-dynamic";

const runtimeConfigKeys = [
  "NEXT_PUBLIC_API_BASE_URL",
  "NEXT_PUBLIC_SIGNALR_ENABLED",
  "NEXT_PUBLIC_SIGNALR_UPDATES_HUB_URL",
  "NEXT_PUBLIC_SIGNALR_TELEGRAM_AUTH_HUB_URL",
  "NEXT_PUBLIC_YANDEX_MAPS_API_KEY",
  "NEXT_PUBLIC_SITE_URL",
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
  metadataBase: new URL(getSiteUrl()),
  applicationName: siteSeo.name,
  title: {
    default: siteSeo.title,
    template: `%s | ${siteSeo.name}`,
  },
  description: siteSeo.description,
  keywords: [...siteSeo.keywords],
  authors: [{ name: siteSeo.name }],
  creator: siteSeo.name,
  publisher: siteSeo.name,
  manifest: "/manifest.webmanifest",
  alternates: {
    canonical: "/",
    languages: {
      "ru-TJ": "/",
      ru: "/",
    },
  },
  openGraph: {
    type: "website",
    locale: siteSeo.locale,
    url: "/",
    siteName: siteSeo.name,
    title: siteSeo.title,
    description: siteSeo.description,
    images: [
      {
        url: "/pharmacy-integration-banner.png",
        width: 1823,
        height: 863,
        alt: "Yalla Pharm — онлайн-аптека Душанбе",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: siteSeo.title,
    description: siteSeo.description,
    images: ["/pharmacy-integration-banner.png"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
  category: "healthcare",
  other: {
    "geo.region": siteSeo.region,
    "geo.placename": "Dushanbe, Tajikistan",
    "geo.position": `${siteSeo.latitude};${siteSeo.longitude}`,
    ICBM: `${siteSeo.latitude}, ${siteSeo.longitude}`,
    "place:location:latitude": String(siteSeo.latitude),
    "place:location:longitude": String(siteSeo.longitude),
  },
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
  themeColor: "#FFFFFF",
  // viewport-fit=cover is what makes env(safe-area-inset-*) become
  // non-zero on iOS — required for safe-bottom utility to push content
  // above the home indicator and Safari's retractable bottom toolbar.
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const structuredData = JSON.stringify(buildStructuredData()).replace(/</g, "\\u003c");

  return (
    <html lang="ru">
      <head>
        <script
          id="yalla-runtime-config"
          dangerouslySetInnerHTML={{ __html: getRuntimeConfigScript() }}
        />
        <script
          id="yalla-structured-data"
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: structuredData }}
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
