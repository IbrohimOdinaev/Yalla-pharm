import type { Metadata } from "next";
import { PharmacyPartnerLanding } from "./PharmacyPartnerLanding";

export const metadata: Metadata = {
  title: "Подключение аптек",
  description:
    "Информация для аптек Душанбе: подключение к Yalla Pharm, онлайн-заказы, доставка и интеграция остатков через 1С.",
  alternates: {
    canonical: "/for-pharmacies",
  },
};

export default function ForPharmaciesPage() {
  return <PharmacyPartnerLanding />;
}
