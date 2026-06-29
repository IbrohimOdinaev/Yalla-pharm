import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Аптеки на карте Душанбе",
  description: "Карта аптек Душанбе в Yalla Pharm: адреса, наличие и выбор аптеки для заказа.",
  alternates: {
    canonical: "/pharmacies/map",
  },
  openGraph: {
    title: "Аптеки на карте Душанбе",
    description: "Найдите аптеки Душанбе на карте и выберите аптеку для заказа лекарств.",
    url: "/pharmacies/map",
  },
};

export default function PharmaciesMapLayout({ children }: { children: React.ReactNode }) {
  return children;
}
