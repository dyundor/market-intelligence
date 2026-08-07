import type { ProductCategory, ProductDictionary } from "./types.ts";
import { PRODUCT_CATEGORIES, SANITARY_WARE_PARENT } from "./dictionary.ts";

export function normalizeProductTerm(input: string): string {
  return input.trim().toLowerCase().replace(/\s+/g, " ");
}

export function createProductDictionary(): ProductDictionary {
  const categories = [...PRODUCT_CATEGORIES, SANITARY_WARE_PARENT];
  const index = new Map<string, ProductCategory>();
  for (const category of categories) {
    for (const term of [category.id, category.name, ...category.keywords, ...category.aliases]) {
      const key = normalizeProductTerm(term);
      if (key && !index.has(key)) index.set(key, category);
    }
  }
  return {
    categories,
    resolve(input) {
      if (!input) return null;
      return index.get(normalizeProductTerm(input)) || null;
    },
  };
}

export const productDictionary = createProductDictionary();

export function resolveProduct(input: string | null | undefined): ProductCategory | null {
  return productDictionary.resolve(input || "");
}
