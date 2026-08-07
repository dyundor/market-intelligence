import type { BuyerMetrics, RankingMetric } from "./types.ts";

export const RANKING_METRICS: RankingMetric[] = [
  "shipment_count",
  "import_frequency",
  "supplier_count",
  "weight",
  "estimated_volume",
  "last_import_date",
];

export function toNumber(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function dateToYmdNumber(value: unknown): number {
  if (typeof value !== "string") return 0;
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value.trim());
  if (!match) return 0;
  return Number(`${match[1]}${match[2]}${match[3]}`);
}

export function buyerMetrics(row: Record<string, unknown>, months: number): BuyerMetrics {
  const shipments = toNumber(row.selected_month_shipments, toNumber(row.relationship_shipments, 0));
  const suppliers = toNumber(row.supplier_count, 0);
  const weightKg = toNumber(row.selected_month_weight_kg, 0);
  const containers = toNumber(row.selected_month_containers, 0);
  return {
    shipments,
    suppliers,
    weightKg,
    containers,
    months: Math.max(1, months),
    lastImportDate: dateToYmdNumber(row.latest_shipment_date),
  };
}

export function metricValue(metric: RankingMetric, metrics: BuyerMetrics): number {
  switch (metric) {
    case "shipment_count":
      return metrics.shipments;
    case "import_frequency":
      return metrics.shipments / metrics.months;
    case "supplier_count":
      return metrics.suppliers;
    case "weight":
      return metrics.weightKg;
    case "estimated_volume":
      return metrics.containers * 20;
    case "last_import_date":
      return metrics.lastImportDate;
  }
}
