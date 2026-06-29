import type { Metadata } from "next";
import { AppShell } from "@/widgets/layout/AppShell";
import { CatalogView } from "@/widgets/catalog/CatalogView";

export const metadata: Metadata = {
  title: "Каталог лекарств",
  description: "Каталог лекарств и товаров для здоровья в аптеках Душанбе: поиск, наличие и цены.",
  alternates: {
    canonical: "/catalog",
  },
};

export default function CatalogPage() {
  return (
    <AppShell>
      <CatalogView />
    </AppShell>
  );
}
