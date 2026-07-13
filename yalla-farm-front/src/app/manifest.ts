import type { MetadataRoute } from "next";
import { siteSeo } from "@/shared/seo/site";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: siteSeo.title,
    short_name: siteSeo.name,
    description: siteSeo.description,
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#ffffff",
    lang: "ru-TJ",
    categories: ["health", "medical", "shopping"],
    icons: [
      {
        src: "/logo-icon.png",
        sizes: "718x698",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/apple-touch-icon.png",
        sizes: "180x180",
        type: "image/png",
      },
    ],
  };
}
