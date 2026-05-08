"use client";

import { useCallback, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAppSelector } from "@/shared/lib/redux";
import { getAllMedicines } from "@/entities/medicine/admin-api";
import { CatalogView, type CatalogFetcher } from "@/widgets/catalog/CatalogView";
import { PharmacistShell } from "@/widgets/layout/PharmacistShell";

// Same layout as /catalog/[slug] but scoped to the pharmacist:
//   • renders inside PharmacistShell (active-prescription pill + bottom nav)
//   • uses the admin /medicines/all endpoint so out-of-stock items stay
//     visible — pharmacists need the full inventory when assembling a
//     prescription checklist, not just the in-stock subset clients see.
export default function PharmacistCatalogCategoryPage() {
  const params = useParams<{ slug: string }>();
  const slug = params?.slug ?? "";
  const router = useRouter();

  const token = useAppSelector((s) => s.auth.token);
  const role = useAppSelector((s) => s.auth.role);
  const hydrated = useAppSelector((s) => s.auth.hydrated);

  useEffect(() => {
    if (!hydrated) return;
    if (!token) { router.replace("/login/admin?redirect=/pharmacist/catalog"); return; }
    if (role && role !== "Pharmacist") router.replace("/");
  }, [hydrated, token, role, router]);

  const fetcher = useCallback<CatalogFetcher>(
    async (page, pageSize, categoryId) => {
      const data = await getAllMedicines(token ?? "", "", page, pageSize, undefined, categoryId);
      return {
        medicines: data.medicines,
        totalCount: data.totalCount,
        page: data.page,
        pageSize: data.pageSize,
      };
    },
    [token],
  );

  if (!hydrated || !token || role !== "Pharmacist") return null;

  return (
    <PharmacistShell>
      <CatalogView
        categorySlug={slug}
        basePath="/pharmacist/catalog"
        fetcher={fetcher}
      />
    </PharmacistShell>
  );
}
