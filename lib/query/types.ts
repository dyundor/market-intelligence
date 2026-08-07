import type { BuyerRanking } from "../ranking/types.ts";

export type Intent = "buyer_ranking" | "supplier_ranking" | "trade_trend";
export type ProviderKind = "free" | "paid";
export type TradeFlow = "import" | "export";
export type Granularity = "monthly" | "annual";
export type RankingMetric = "shipment_count" | "import_frequency" | "supplier_count" | "weight" | "estimated_volume";

export interface RankingSpec {
  limit: number;
  metric?: RankingMetric;
}

export interface QueryRequest {
  intent: Intent;
  subject: string;
  market: string;
  period: string;
  ranking?: RankingSpec;
  flow?: TradeFlow;
  granularity?: Granularity;
  range?: number;
  months?: string[];
}

export interface QueryValidation {
  ok: boolean;
  errors: string[];
}

export interface ProviderPlan {
  providerId: string;
  kind: ProviderKind;
  reason: string;
  estimatedCredits: number;
  required: boolean;
}

export interface RejectedProvider {
  providerId: string;
  reason: string;
}

export interface PlannedQuery {
  query: QueryRequest;
  requiredProviders: ProviderPlan[];
  rejectedProviders: RejectedProvider[];
  summary: string;
}

export type QueryStatus = "cache_hit" | "free_source" | "completed" | "awaiting_approval" | "budget_blocked" | "failed";

export interface CacheMeta {
  hit: boolean;
  source: string;
  storedAt: string;
  expiresAt: string;
}

export interface Company {
  id: string;
  name: string;
  country: string;
  website: string | null;
  shipments: number;
}

export interface TradeSeriesPoint {
  period: string;
  label: string;
  tradeValue: number;
  netWeightKg: number;
  isEstimated: boolean;
}

export interface TradePartner {
  code: number;
  iso2: string;
  name: string;
  englishName?: string;
  flag: string;
  value: number;
  share: number;
  netWeightKg: number;
  isEstimated: boolean;
}

export type AvailabilityStatus = "available" | "fallback" | "not_released" | "no_trade_record";

export interface TradeMetric {
  source: string;
  sourceUrl: string;
  access: string;
  market: string;
  product: string;
  flow: TradeFlow;
  granularity: Granularity;
  range: number;
  availabilityStatus: AvailabilityStatus;
  requestedPeriod: string;
  period: string;
  latestReportedPeriod: string;
  recordCount: number;
  hsCode: string;
  tradeValue: number;
  netWeightKg: number;
  isNetWeightEstimated: boolean;
  series: TradeSeriesPoint[];
  partners: TradePartner[];
  fetchedAt: string;
  licenseNote: string;
}

export interface DiscoveryRow {
  [key: string]: unknown;
}

export interface SupplierDiscovery {
  available: boolean;
  reason?: string;
  dataset: string;
  market: string;
  flow: string;
  product: string;
  hsCode: string;
  requestedMonths: string[];
  latestAvailableMonth: string;
  importers: DiscoveryRow[];
  suppliers: DiscoveryRow[];
  storedShipmentCoverage: DiscoveryRow[];
}

export type NormalizedData =
  | { kind: "companies"; companies: Company[] }
  | { kind: "trade"; metric: TradeMetric }
  | { kind: "discovery"; discovery: SupplierDiscovery }
  | { kind: "ranking"; ranking: BuyerRanking };

export interface QueryCost {
  estimated: number;
  percentOfTotal: number;
}

export interface QueryResult {
  queryId: string;
  intent: Intent;
  source: string[];
  cached: boolean;
  cost: QueryCost;
  data?: NormalizedData;
  metadata: Record<string, unknown>;
  status: QueryStatus;
  reason?: string;
}

export interface QueryLogEntry {
  queryId: string;
  intent: Intent;
  subject: string;
  market: string;
  period: string;
  provider: string | null;
  status: QueryStatus;
  cost: number | null;
  createdAt: string;
}
