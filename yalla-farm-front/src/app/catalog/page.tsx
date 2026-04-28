import type { Metadata } from "next";
import { AppShell } from "@/widgets/layout/AppShell";
import { CatalogView } from "@/widgets/catalog/CatalogView";

export const metadata: Metadata = {
  title: "Каталог | Yalla Farm",
  description: "Все лекарства и товары для здоровья — каталог онлайн-аптеки Душанбе.",
};

export default function CatalogPage() {
  return (
    <AppShell>
      <CatalogView />
    </AppShell>
  );
}
