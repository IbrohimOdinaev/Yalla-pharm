import { apiFetch } from "@/shared/api/http-client";
import type { ApiCategory } from "@/shared/types/api";

let cachedCategories: ApiCategory[] | null = null;

export async function getCategories(): Promise<ApiCategory[]> {
  if (cachedCategories) return cachedCategories;
  const response = await apiFetch<{ categories?: ApiCategory[] }>("/api/categories");
  cachedCategories = Array.isArray(response?.categories) ? response.categories : [];
  return cachedCategories;
}

export function flattenCategories(categories: ApiCategory[]): ApiCategory[] {
  const result: ApiCategory[] = [];
  function walk(cats: ApiCategory[]) {
    for (const cat of cats) {
      result.push(cat);
      if (cat.children?.length) walk(cat.children);
    }
  }
  walk(categories);
  return result;
}
