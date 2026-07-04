import type { Metadata } from "next";
import type { ReactNode } from "react";
import { fetchSeoPharmacies } from "@/shared/seo/api";
import { absoluteUrl, siteSeo } from "@/shared/seo/site";

export const metadata: Metadata = {
  title: "Аптеки Душанбе",
  description: "Аптеки Душанбе на карте Yalla Pharm: адреса, режим работы 24/7, наличие доставки и выбор ближайшей аптеки.",
  keywords: [
    "аптеки Душанбе",
    "карта аптек Душанбе",
    "аптека 24/7 Душанбе",
    "доставка из аптеки Душанбе",
    "дорухона Душанбе",
  ],
  alternates: {
    canonical: "/pharmacies",
  },
  openGraph: {
    title: "Аптеки Душанбе | Yalla Pharm",
    description: "Список аптек Душанбе, карта, режим работы и фильтр по доставке.",
    url: "/pharmacies",
    type: "website",
    locale: siteSeo.locale,
    images: [
      {
        url: "/pharmacy-integration-banner.png",
        width: 1823,
        height: 863,
        alt: "Аптеки Душанбе на Yalla Pharm",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Аптеки Душанбе | Yalla Pharm",
    description: "Список аптек Душанбе, карта, режим работы и фильтр по доставке.",
    images: ["/pharmacy-integration-banner.png"],
  },
  other: {
    "geo.region": siteSeo.region,
    "geo.placename": "Dushanbe, Tajikistan",
    "geo.position": `${siteSeo.latitude};${siteSeo.longitude}`,
    ICBM: `${siteSeo.latitude}, ${siteSeo.longitude}`,
  },
};

function formatHours(opensAt?: string | null, closesAt?: string | null) {
  if (!opensAt && !closesAt) return "Mo-Su 00:00-23:59";
  const open = (opensAt ?? "00:00").slice(0, 5);
  const close = (closesAt ?? "23:59").slice(0, 5);
  if (open === "00:00" && (close === "23:59" || close === "00:00")) return "Mo-Su 00:00-23:59";
  return `Mo-Su ${open}-${close === "00:00" ? "23:59" : close}`;
}

export default async function PharmaciesLayout({ children }: { children: ReactNode }) {
  const pharmacies = await fetchSeoPharmacies();
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    "@id": absoluteUrl("/pharmacies#webpage"),
    name: "Аптеки Душанбе",
    description: metadata.description,
    url: absoluteUrl("/pharmacies"),
    inLanguage: "ru-TJ",
    isPartOf: {
      "@id": absoluteUrl("/#website"),
    },
    about: {
      "@type": "MedicalBusiness",
      name: siteSeo.name,
      areaServed: {
        "@type": "City",
        name: "Dushanbe",
      },
    },
    mainEntity: {
      "@type": "ItemList",
      numberOfItems: pharmacies.length,
      itemListElement: pharmacies.map((pharmacy, index) => ({
        "@type": "ListItem",
        position: index + 1,
        item: {
          "@type": "Pharmacy",
          "@id": absoluteUrl(`/pharmacies#${encodeURIComponent(pharmacy.id)}`),
          name: pharmacy.title,
          url: absoluteUrl("/pharmacies"),
          address: {
            "@type": "PostalAddress",
            streetAddress: pharmacy.address,
            addressLocality: "Dushanbe",
            addressRegion: "Dushanbe",
            addressCountry: siteSeo.country,
          },
          geo: pharmacy.latitude != null && pharmacy.longitude != null
            ? {
                "@type": "GeoCoordinates",
                latitude: pharmacy.latitude,
                longitude: pharmacy.longitude,
              }
            : undefined,
          openingHours: formatHours(pharmacy.opensAt, pharmacy.closesAt),
          areaServed: "Dushanbe",
          hasOfferCatalog: pharmacy.hasDelivery
            ? {
                "@type": "OfferCatalog",
                name: "Доставка лекарств в Душанбе",
              }
            : undefined,
        },
      })),
    },
  };

  return (
    <>
      <script
        id="yalla-pharmacies-structured-data"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData).replace(/</g, "\\u003c") }}
      />
      {children}
    </>
  );
}
