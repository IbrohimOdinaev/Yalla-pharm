import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Аптеки Душанбе",
  description: "Список аптек Душанбе и карта аптек Yalla Pharm с режимом работы и фильтрами.",
  alternates: {
    canonical: "/pharmacies",
  },
  openGraph: {
    title: "Аптеки Душанбе | Yalla Pharm",
    description: "Список аптек Душанбе и карта аптек Yalla Pharm.",
    url: "/pharmacies",
  },
};

export default function PharmaciesLayout({ children }: { children: ReactNode }) {
  return children;
}
