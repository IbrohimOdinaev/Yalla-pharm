import type { Metadata } from "next";
import { PharmacyPartnerLanding } from "./PharmacyPartnerLanding";

export const metadata: Metadata = {
  title: "Подключение аптек | Yalla Pharm",
  description:
    "Информация для аптек Душанбе: подключение к Yalla Pharm, онлайн-заказы, доставка и интеграция остатков через 1С.",
};

export default function ForPharmaciesPage() {
  return <PharmacyPartnerLanding />;
}
