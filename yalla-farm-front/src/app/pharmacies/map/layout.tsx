import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Аптеки Душанбе",
  description: "Карта аптек Душанбе в Yalla Pharm: адреса, наличие и выбор аптеки для заказа.",
  alternates: {
    canonical: "/pharmacies",
  },
  openGraph: {
    title: "Аптеки Душанбе",
    description: "Найдите аптеки Душанбе на карте и выберите аптеку для заказа лекарств.",
    url: "/pharmacies",
  },
};

export default function PharmaciesMapLayout({ children }: { children: ReactNode }) {
  return children;
}
