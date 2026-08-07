import { companyFromRow, type Company } from "./company.ts";

export interface Supplier extends Company {
  entityType: "supplier";
}

export function supplierFromRow(row: Record<string, unknown>): Supplier {
  return { ...companyFromRow(row), entityType: "supplier" };
}
