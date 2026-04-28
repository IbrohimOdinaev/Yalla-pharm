import type { Metadata } from "next";
import { AppShell } from "@/widgets/layout/AppShell";
import { CatalogView } from "@/widgets/catalog/CatalogView";

type Params = Promise<{ slug: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug } = await params;
  // Slugs are kebab-case, so a humane fallback works as a title hint —
  // detailed name shown in <h1> still comes from the loaded category.
  const pretty = slug
    .split("-")
    .filter(Boolean)
    .map((s) => s[0].toUpperCase() + s.slice(1))
    .join(" ");
  return {
    title: `${pretty} | Каталог | Yalla Farm`,
    description: `Каталог категории «${pretty}» — лекарства и товары для здоровья.`,
  };
}

export default async function CatalogCategoryPage({ params }: { params: Params }) {
  const { slug } = await params;
  return (
    <AppShell>
      <CatalogView categorySlug={slug} />
    </AppShell>
  );
}
