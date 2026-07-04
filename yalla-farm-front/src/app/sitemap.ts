import type { MetadataRoute } from "next";
import { absoluteUrl, publicSeoRoutes } from "@/shared/seo/site";
import { fetchSeoCategoryRoutes, fetchSeoMedicineRoutes } from "@/shared/seo/api";

export const dynamic = "force-dynamic";

function uniqueByUrl(routes: MetadataRoute.Sitemap): MetadataRoute.Sitemap {
  const seen = new Set<string>();
  return routes.filter((route) => {
    if (seen.has(route.url)) return false;
    seen.add(route.url);
    return true;
  });
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const lastModified = new Date();

  const staticRoutes: MetadataRoute.Sitemap = publicSeoRoutes.map((route) => ({
    url: absoluteUrl(route.path),
    lastModified,
    changeFrequency: route.changeFrequency,
    priority: route.priority,
  }));

  const [categoryRoutes, medicineRoutes] = await Promise.all([
    fetchSeoCategoryRoutes(),
    fetchSeoMedicineRoutes(),
  ]);

  return uniqueByUrl([
    ...staticRoutes,
    ...categoryRoutes.map((route) => ({
      url: absoluteUrl(route.path),
      lastModified,
      changeFrequency: "weekly" as const,
      priority: 0.72,
    })),
    ...medicineRoutes.map((route) => ({
      url: absoluteUrl(route.path),
      lastModified,
      changeFrequency: "weekly" as const,
      priority: 0.64,
    })),
  ]);
}
