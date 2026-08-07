import { resolveProduct } from "../products/resolver.ts";
import { PRODUCT_CATEGORIES } from "../products/dictionary.ts";

export interface Product {
  categoryId: string;
  name: string;
  description: string;
  hsCodes: string[];
  defaultHsCode: string;
}

export interface ProductClassification {
  categoryId: string;
  keywords: string[];
}

export function classifyProductText(text: string): ProductClassification {
  if (!text) return { categoryId: "unknown", keywords: [] };
  const lower = text.toLowerCase();
  for (const category of PRODUCT_CATEGORIES) {
    for (const token of [category.id, ...category.keywords, ...category.aliases]) {
      if (token.length >= 3 && lower.includes(token.toLowerCase())) {
        return { categoryId: category.id, keywords: category.keywords };
      }
    }
  }
  return { categoryId: "unknown", keywords: [] };
}

export function productFromSubject(subject: string): Product {
  const category = resolveProduct(subject);
  if (!category) {
    return {
      categoryId: subject,
      name: subject,
      description: subject,
      hsCodes: [],
      defaultHsCode: "",
    };
  }
  return {
    categoryId: category.id,
    name: category.name,
    description: category.description,
    hsCodes: category.hsCodes,
    defaultHsCode: category.defaultHsCode,
  };
}

export function hsCodeWithoutDot(code: string): string {
  return code.replace(".", "");
}
