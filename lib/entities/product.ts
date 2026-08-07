import { resolveProduct } from "../products/resolver.ts";

export interface Product {
  categoryId: string;
  name: string;
  description: string;
  hsCodes: string[];
  defaultHsCode: string;
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
