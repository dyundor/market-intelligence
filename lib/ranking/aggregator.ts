import type { Shipment } from "../entities/shipment.ts";
import { companyFromRow } from "../entities/company.ts";
import { companyIdentityKey } from "../entities/company.ts";
import { buyerMetrics, dateToYmdNumber } from "./metrics.ts";
import type { BuyerMetrics } from "./types.ts";

export interface AggregateEntry {
  key: string;
  buyerId: string;
  buyerName: string;
  row: Record<string, unknown>;
  metrics: BuyerMetrics;
}

export function aggregateImporters(rows: Array<Record<string, unknown>>, months: number): AggregateEntry[] {
  return rows.map(row => {
    const company = companyFromRow(row);
    const metrics = buyerMetrics(row, months);
    return {
      key: company.identityKey || company.id || "unknown-buyer",
      buyerId: company.id,
      buyerName: company.name,
      row,
      metrics,
    };
  });
}

export function aggregateShipments(shipments: Shipment[], months: number): AggregateEntry[] {
  const groups = new Map<string, AggregateEntry & { supplierSet: Set<string>; monthSet: Set<string> }>();
  for (const shipment of shipments) {
    const buyerId = shipment.importerId || "";
    const buyerName = shipment.importerName || "";
    const key = companyIdentityKey(buyerName) || buyerId || "unknown-buyer";
    let entry = groups.get(key);
    if (!entry) {
      entry = {
        key,
        buyerId,
        buyerName,
        row: { id: buyerId, name: buyerName },
        metrics: { shipments: 0, suppliers: 0, weightKg: 0, containers: 0, months: Math.max(1, months), lastImportDate: 0 },
        supplierSet: new Set(),
        monthSet: new Set(),
      };
      groups.set(key, entry);
    }
    entry.metrics.shipments += 1;
    if (shipment.supplierId) entry.supplierSet.add(shipment.supplierId);
    entry.metrics.weightKg += shipment.weight || 0;
    entry.metrics.containers += shipment.containerCount || 0;
    if (shipment.shipmentDate) {
      const ymd = dateToYmdNumber(shipment.shipmentDate);
      if (ymd > entry.metrics.lastImportDate) entry.metrics.lastImportDate = ymd;
      entry.monthSet.add(shipment.shipmentDate.slice(0, 7));
    }
  }
  return [...groups.values()].map(({ supplierSet, monthSet, ...entry }) => {
    entry.metrics.suppliers = supplierSet.size;
    entry.metrics.months = Math.max(1, monthSet.size || Math.max(1, months));
    entry.row = {
      ...entry.row,
      selected_month_shipments: entry.metrics.shipments,
      supplier_count: entry.metrics.suppliers,
      selected_month_weight_kg: entry.metrics.weightKg,
      selected_month_containers: entry.metrics.containers,
      last_import_date: entry.metrics.lastImportDate,
    };
    return entry;
  });
}
