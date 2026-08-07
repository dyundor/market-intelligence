import type { QueryRequest, RankingMetric, SupplierDiscovery } from "../query/types.ts";
import type { BuyerMetrics, BuyerRanking, RankedBuyer, RankOptions } from "./types.ts";
import { resolveProduct } from "../products/resolver.ts";

export const RANKING_METRICS: RankingMetric[] = [
  "shipment_count",
  "import_frequency",
  "supplier_count",
  "weight",
  "estimated_volume",
];

const toNumber = (value: unknown, fallback = 0): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export function buyerMetrics(row: Record<string, unknown>, months: number): BuyerMetrics {
  const shipments = toNumber(row.selected_month_shipments, toNumber(row.relationship_shipments, 0));
  const suppliers = toNumber(row.supplier_count, 0);
  const weightKg = toNumber(row.selected_month_weight_kg, 0);
  const containers = toNumber(row.selected_month_containers, 0);
  return { shipments, suppliers, weightKg, containers, months: Math.max(1, months) };
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
  }
}

export function rankBuyers(view: SupplierDiscovery, options: RankOptions): BuyerRanking {
  const rows = (view.importers || []).map(row => {
    const metrics = buyerMetrics(row, view.requestedMonths.length);
    const buyerId = String(row.id || row.name || "");
    return {
      row,
      buyerId,
      name: String(row.name || buyerId),
      value: metricValue(options.metric, metrics),
    };
  });
  const sorted = rows.sort(
    (left, right) =>
      right.value - left.value ||
      left.name.localeCompare(right.name) ||
      left.buyerId.localeCompare(right.buyerId),
  );
  const ranked: RankedBuyer[] = sorted.slice(0, options.limit).map((entry, index) => ({
    ...entry.row,
    rank: index + 1,
    metric_value: entry.value,
  }));

  return {
    available: view.available,
    reason: view.reason,
    dataset: view.dataset,
    market: view.market,
    flow: view.flow,
    product: view.product,
    productCategory: resolveProduct(view.product)?.id || view.product,
    hsCode: view.hsCode,
    requestedMonths: view.requestedMonths,
    latestAvailableMonth: view.latestAvailableMonth,
    metric: options.metric,
    topLimit: options.limit,
    topCount: ranked.length,
    totalCount: rows.length,
    ranked,
    suppliers: view.suppliers || [],
    storedShipmentCoverage: view.storedShipmentCoverage || [],
  };
}

export function rankingViewQuery(query: QueryRequest, requestedLimit: number, metric: RankingMetric): QueryRequest {
  return { ...query, ranking: { limit: requestedLimit, metric } };
}
