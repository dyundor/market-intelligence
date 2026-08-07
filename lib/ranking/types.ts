export type RankingMetric = "shipment_count" | "import_frequency" | "supplier_count" | "weight" | "estimated_volume" | "last_import_date";

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
  suppliers: Array<Record<string, unknown>>;
  storedShipmentCoverage: Array<Record<string, unknown>>;
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
  lastImportDate: number;
}

export interface DiscoveryView {
  available: boolean;
  reason?: string;
  dataset: string;
  market: string;
  flow: string;
  product: string;
  hsCode: string;
  requestedMonths: string[];
  latestAvailableMonth: string;
  importers: Array<Record<string, unknown>>;
  suppliers: Array<Record<string, unknown>>;
  storedShipmentCoverage: Array<Record<string, unknown>>;
}
