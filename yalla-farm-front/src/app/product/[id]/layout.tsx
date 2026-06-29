import type { Metadata } from "next";
import type { ApiMedicine } from "@/shared/types/api";
import { absoluteUrl, siteSeo } from "@/shared/seo/site";

type Params = Promise<{ id: string }>;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function getServerApiBaseUrl() {
  const value = process.env.INTERNAL_API_URL || process.env.NEXT_PUBLIC_API_BASE_URL || "";
  return value.replace(/\/+$/, "");
}

function getMedicineName(medicine: ApiMedicine | null) {
  return medicine?.title || medicine?.name || "Товар";
}

function truncate(value: string, maxLength: number) {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength - 1).trimEnd()}…`;
}

function getDescription(medicine: ApiMedicine | null) {
  if (!medicine) {
    return "Карточка товара Yalla Pharm: наличие лекарств, цены и заказ в аптеках Душанбе.";
  }

  const name = getMedicineName(medicine);
  if (medicine.description?.trim()) return truncate(medicine.description, 155);

  return `Купить ${name} в аптеках Душанбе через Yalla Pharm: наличие, цены и оформление заказа онлайн.`;
}

function getMedicineImageUrl(medicine: ApiMedicine | null) {
  const images = medicine?.images ?? [];
  const image = images.find((item) => item.isMain) ?? images.find((item) => item.isMinimal) ?? images[0];

  if (image?.url) return image.url;
  if (image?.id) return absoluteUrl(`/api/medicines/images/${image.id}/content?w=800`);

  return absoluteUrl("/box-yalla-for-website-1.webp");
}

async function fetchMedicineForSeo(idOrSlug: string): Promise<ApiMedicine | null> {
  const apiBaseUrl = getServerApiBaseUrl();
  if (!apiBaseUrl || !idOrSlug) return null;

  const endpoint = UUID_RE.test(idOrSlug)
    ? `/api/medicines/${idOrSlug}`
    : `/api/medicines/by-slug/${encodeURIComponent(idOrSlug)}`;

  try {
    const response = await fetch(`${apiBaseUrl}${endpoint}`, {
      next: { revalidate: 300 },
    });
    if (!response.ok) return null;

    const data = (await response.json()) as { medicine?: ApiMedicine };
    return data.medicine ?? null;
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { id } = await params;
  const medicine = await fetchMedicineForSeo(id);
  const title = `${getMedicineName(medicine)} в Душанбе`;
  const description = getDescription(medicine);
  const imageUrl = getMedicineImageUrl(medicine);
  const canonicalPath = `/product/${medicine?.slug || id}`;

  return {
    title,
    description,
    alternates: {
      canonical: canonicalPath,
    },
    openGraph: {
      type: "website",
      title,
      description,
      url: canonicalPath,
      images: [
        {
          url: imageUrl,
          alt: title,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [imageUrl],
    },
    robots: {
      index: medicine?.isActive !== false,
      follow: true,
    },
  };
}

function buildProductStructuredData(medicine: ApiMedicine | null, id: string) {
  if (!medicine) return null;

  const name = getMedicineName(medicine);
  const prices = (medicine.offers ?? [])
    .filter((offer) => offer.stockQuantity > 0 && offer.price > 0)
    .map((offer) => offer.price);
  const lowPrice = medicine.minPrice || (prices.length > 0 ? Math.min(...prices) : medicine.price);
  const canonicalUrl = absoluteUrl(`/product/${medicine.slug || id}`);

  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name,
    description: getDescription(medicine),
    image: getMedicineImageUrl(medicine),
    sku: medicine.articul || medicine.barcode || medicine.id,
    category: medicine.categoryName,
    brand: {
      "@type": "Brand",
      name: siteSeo.name,
    },
    url: canonicalUrl,
    offers: lowPrice
      ? {
          "@type": "AggregateOffer",
          priceCurrency: "TJS",
          lowPrice,
          offerCount: prices.length || undefined,
          availability: prices.length > 0 ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
          url: canonicalUrl,
        }
      : undefined,
  };
}

export default async function ProductLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Params;
}) {
  const { id } = await params;
  const medicine = await fetchMedicineForSeo(id);
  const structuredData = buildProductStructuredData(medicine, id);

  return (
    <>
      {structuredData ? (
        <script
          id="yalla-product-structured-data"
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData).replace(/</g, "\\u003c") }}
        />
      ) : null}
      {children}
    </>
  );
}
