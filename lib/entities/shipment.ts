export interface Shipment {
  id: string;
  supplierId: string | null;
  importerId: string | null;
  importerName: string | null;
  shipmentDate: string | null;
  weightKg: number;
  containerCount: number;
  quantity: number;
  freightUsd: number;
  hsCodes: string;
  productDescriptions: string;
  sourceChannel: string;
  sourceUrl: string;
}

const toNumber = (value: unknown): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

export function shipmentFromRow(row: Record<string, unknown>): Shipment {
  return {
    id: String(row.id || ""),
    supplierId: row.supplier_id ? String(row.supplier_id) : null,
    importerId: row.importer_id ? String(row.importer_id) : null,
    importerName: row.importer_name ? String(row.importer_name) : null,
    shipmentDate: row.shipment_date ? String(row.shipment_date) : null,
    weightKg: toNumber(row.weight_kg),
    containerCount: toNumber(row.container_count),
    quantity: toNumber(row.quantity),
    freightUsd: toNumber(row.estimated_freight_usd),
    hsCodes: String(row.hs_codes || ""),
    productDescriptions: String(row.product_descriptions || ""),
    sourceChannel: String(row.source_channel || "unknown"),
    sourceUrl: String(row.source_url || ""),
  };
}
