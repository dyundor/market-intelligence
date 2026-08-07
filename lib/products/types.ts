export interface ProductCategory {
  id: string;
  name: string;
  parentId: string | null;
  description: string;
  hsCodes: string[];
  defaultHsCode: string;
  keywords: string[];
  aliases: string[];
}

export interface ProductDictionary {
  categories: ProductCategory[];
  resolve(input: string): ProductCategory | null;
}
