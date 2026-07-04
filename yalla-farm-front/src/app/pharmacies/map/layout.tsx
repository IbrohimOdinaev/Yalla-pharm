import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Карта аптек Душанбе",
  description: "Карта аптек Душанбе в Yalla Pharm: адреса, наличие и выбор аптеки для заказа.",
  alternates: {
    canonical: "/pharmacies/map",
  },
  openGraph: {
    title: "Карта аптек Душанбе | Yalla Pharm",
    description: "Найдите аптеки Душанбе на карте и выберите аптеку для заказа лекарств.",
    url: "/pharmacies/map",
  },
};

export default function PharmaciesMapLayout({ children }: { children: ReactNode }) {
  return children;
}
