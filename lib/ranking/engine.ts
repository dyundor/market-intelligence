import type { SupplierDiscovery } from "../query/types.ts";
import type { BuyerRanking, RankedBuyer, RankOptions } from "./types.ts";
import { resolveProduct } from "../products/resolver.ts";
import { aggregateImporters, aggregateShipments, type AggregateEntry } from "./aggregator.ts";
import { metricValue } from "./metrics.ts";
import type { Shipment } from "../entities/shipment.ts";

export { RANKING_METRICS } from "./metrics.ts";

export interface ShipmentRankContext {
  market: string;
  flow: string;
  product: string;
  dataset: string;
  hsCode: string;
  requestedMonths: string[];
  latestAvailableMonth?: string;
  metric: RankOptions["metric"];
  limit: number;
}

function buildRanking(
  entries: AggregateEntry[],
  options: RankOptions,
  view: SupplierDiscovery,
): BuyerRanking {
  const sorted = entries.sort(
    (left, right) =>
      metricValue(options.metric, right.metrics) - metricValue(options.metric, left.metrics) ||
      left.buyerName.localeCompare(right.buyerName) ||
      left.buyerId.localeCompare(right.buyerId),
  );
  const ranked: RankedBuyer[] = sorted.slice(0, options.limit).map((entry, index) => ({
    ...entry.row,
    id: entry.buyerId || entry.row.id,
    name: entry.buyerName || entry.row.name,
    rank: index + 1,
    metric_value: metricValue(options.metric, entry.metrics),
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
    totalCount: sorted.length,
    ranked,
    suppliers: view.suppliers || [],
    storedShipmentCoverage: view.storedShipmentCoverage || [],
  };
}

export function rankBuyers(view: SupplierDiscovery, options: RankOptions): BuyerRanking {
  const entries = aggregateImporters(view.importers || [], view.requestedMonths.length);
  return buildRanking(entries, options, view);
}

export function rankShipments(shipments: Shipment[], context: ShipmentRankContext): BuyerRanking {
  const entries = aggregateShipments(shipments, context.requestedMonths.length);
  const view: SupplierDiscovery = {
    available: true,
    dataset: context.dataset,
    market: context.market,
    flow: context.flow,
    product: context.product,
    hsCode: context.hsCode,
    requestedMonths: context.requestedMonths,
    latestAvailableMonth: context.latestAvailableMonth || "",
    importers: [],
    suppliers: [],
    storedShipmentCoverage: [],
  };
  return buildRanking(entries, { metric: context.metric, limit: context.limit }, view);
}
