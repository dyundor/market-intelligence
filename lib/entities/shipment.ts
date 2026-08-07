import { classifyProductText } from "./product.ts";

export interface Shipment {
  id: string;
  source: string;
  sourceShipmentId: string;
  importerId: string | null;
  importerName: string | null;
  supplierId: string | null;
  productCategory: string;
  productKeywords: string[];
  hsCode: string | null;
  originCountry: string | null;
  destinationCountry: string | null;
  shipmentDate: string | null;
  month: string | null;
  year: number | null;
  quantity: number | null;
  weight: number | null;
  value: number | null;
  containerCount: number | null;
  sourceUrl: string | null;
}

const toNumberOrNull = (value: unknown): number | null => {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

function monthOf(date: string): string | null {
  return /^\d{4}-\d{2}/.test(date) ? date.slice(0, 7) : null;
}

export function shipmentFromRow(row: Record<string, unknown>): Shipment {
  const description = String(row.product_description || row.product_descriptions || "");
  const classification = classifyProductText(description);
  const shipmentDate = row.shipment_date ? String(row.shipment_date) : null;
  const month = shipmentDate ? monthOf(shipmentDate) : null;
  return {
    id: String(row.id || ""),
    source: String(row.source_channel || "importyeti_free_web"),
    sourceShipmentId: String(row.house_bol || row.id || ""),
    importerId: row.importer_id ? String(row.importer_id) : null,
    importerName: row.importer_name ? String(row.importer_name) : null,
    supplierId: row.supplier_id ? String(row.supplier_id) : null,
    productCategory: classification.categoryId,
    productKeywords: classification.keywords,
    hsCode: row.hs_codes ? String(row.hs_codes) : null,
    originCountry: row.origin_country ? String(row.origin_country) : null,
    destinationCountry: row.destination_country ? String(row.destination_country) : null,
    shipmentDate,
    month,
    year: month ? Number(month.slice(0, 4)) : null,
    quantity: toNumberOrNull(row.quantity),
    weight: toNumberOrNull(row.weight_kg),
    value: toNumberOrNull(row.estimated_freight_usd),
    containerCount: toNumberOrNull(row.container_count),
    sourceUrl: row.source_url ? String(row.source_url) : null,
  };
}

export function enrichShipmentRow(row: Record<string, unknown>): Record<string, unknown> {
  return { ...row, ...shipmentFromRow(row) };
}
