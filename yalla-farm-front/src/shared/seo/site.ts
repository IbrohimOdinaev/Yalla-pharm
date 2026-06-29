const DEFAULT_PRODUCTION_SITE_URL = "https://pharm.yalla.tj";
const DEFAULT_LOCAL_SITE_URL = "http://localhost:3000";

function normalizeSiteUrl(value: string) {
  return value.replace(/\/+$/, "");
}

export function getSiteUrl() {
  const configuredUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (configuredUrl) return normalizeSiteUrl(configuredUrl);

  return process.env.NODE_ENV === "development"
    ? DEFAULT_LOCAL_SITE_URL
    : DEFAULT_PRODUCTION_SITE_URL;
}

export const siteSeo = {
  name: "Yalla Pharm",
  title: "Yalla Pharm | Онлайн-аптека Душанбе",
  description:
    "Yalla Pharm — онлайн-аптека в Душанбе: поиск лекарств, наличие в аптеках, оформление заказа и доставка товаров для здоровья.",
  locale: "ru_TJ",
  city: "Dushanbe",
  region: "TJ-DU",
  country: "TJ",
  latitude: 38.5598,
  longitude: 68.787,
  keywords: [
    "Yalla Pharm",
    "онлайн аптека Душанбе",
    "аптека Душанбе",
    "лекарства Душанбе",
    "доставка лекарств Душанбе",
    "товары для здоровья Душанбе",
    "дорухона Душанбе",
    "doru Dushanbe",
    "pharmacy Dushanbe",
    "аптека Таджикистан",
  ],
} as const;

export const publicSeoRoutes = [
  { path: "/", priority: 1, changeFrequency: "daily" as const },
  { path: "/catalog", priority: 0.9, changeFrequency: "daily" as const },
  { path: "/pharmacies/map", priority: 0.8, changeFrequency: "daily" as const },
  { path: "/for-pharmacies", priority: 0.7, changeFrequency: "monthly" as const },
  { path: "/privacy-policy", priority: 0.3, changeFrequency: "yearly" as const },
] as const;

export function absoluteUrl(path = "/") {
  const siteUrl = getSiteUrl();
  return path.startsWith("http") ? path : `${siteUrl}${path.startsWith("/") ? path : `/${path}`}`;
}

export function buildStructuredData() {
  const siteUrl = getSiteUrl();
  const logoUrl = absoluteUrl("/logo-full.png");
  const imageUrl = absoluteUrl("/pharmacy-integration-banner.png");

  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": `${siteUrl}/#organization`,
        name: siteSeo.name,
        url: siteUrl,
        logo: logoUrl,
        sameAs: [],
      },
      {
        "@type": "Pharmacy",
        "@id": `${siteUrl}/#pharmacy`,
        name: siteSeo.name,
        url: siteUrl,
        image: imageUrl,
        logo: logoUrl,
        description: siteSeo.description,
        priceRange: "$$",
        address: {
          "@type": "PostalAddress",
          addressLocality: "Dushanbe",
          addressCountry: siteSeo.country,
        },
        geo: {
          "@type": "GeoCoordinates",
          latitude: siteSeo.latitude,
          longitude: siteSeo.longitude,
        },
        areaServed: [
          {
            "@type": "City",
            name: "Dushanbe",
          },
          {
            "@type": "Country",
            name: "Tajikistan",
          },
        ],
        parentOrganization: {
          "@id": `${siteUrl}/#organization`,
        },
      },
      {
        "@type": "WebSite",
        "@id": `${siteUrl}/#website`,
        name: siteSeo.name,
        url: siteUrl,
        description: siteSeo.description,
        inLanguage: ["ru-TJ", "ru"],
        publisher: {
          "@id": `${siteUrl}/#organization`,
        },
        potentialAction: {
          "@type": "SearchAction",
          target: `${siteUrl}/catalog?query={search_term_string}`,
          "query-input": "required name=search_term_string",
        },
      },
    ],
  };
}
