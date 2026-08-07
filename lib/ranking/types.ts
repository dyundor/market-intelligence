import type { DiscoveryRow, RankingMetric } from "../query/types.ts";

export type RankedBuyer = Record<string, unknown> & { rank: number; metric_value: number };

export interface BuyerRanking {
  available: boolean;
  reason?: string;
  dataset: string;
  market: string;
  flow: string;
  product: string;
  productCategory: string;
  hsCode: string;
  requestedMonths: string[];
  latestAvailableMonth: string;
  metric: RankingMetric;
  topLimit: number;
  topCount: number;
  totalCount: number;
  ranked: RankedBuyer[];
  suppliers: DiscoveryRow[];
  storedShipmentCoverage: DiscoveryRow[];
}

export interface RankOptions {
  limit: number;
  metric: RankingMetric;
}

export interface BuyerMetrics {
  shipments: number;
  suppliers: number;
  weightKg: number;
  containers: number;
  months: number;
}
