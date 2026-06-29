import type { MetadataRoute } from "next";
import { absoluteUrl, getSiteUrl } from "@/shared/seo/site";

export default function robots(): MetadataRoute.Robots {
  const host = getSiteUrl();

  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/catalog", "/catalog/", "/pharmacies/map", "/for-pharmacies", "/privacy-policy"],
        disallow: [
          "/api/",
          "/cart",
          "/checkout",
          "/login",
          "/orders",
          "/payment-",
          "/pharmacist",
          "/prescriptions",
          "/profile",
          "/register",
          "/superadmin",
          "/workspace",
        ],
      },
    ],
    sitemap: absoluteUrl("/sitemap.xml"),
    host,
  };
}
