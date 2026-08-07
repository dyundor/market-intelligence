export type Intent = "buyer_ranking" | "supplier_ranking" | "trade_trend";
export type ProviderKind = "free" | "paid";

export interface RankingSpec {
  limit: number;
}

export interface QueryRequest {
  intent: Intent;
  subject: string;
  market: string;
  period: string;
  ranking?: RankingSpec;
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

export interface TradePartner {
  code: string;
  name: string;
  value: number;
  share: number;
}

export interface TradeMetric {
  period: string;
  value: number;
  partners: TradePartner[];
}

export type NormalizedData =
  | { kind: "companies"; companies: Company[] }
  | { kind: "trade"; metric: TradeMetric };

export interface QueryResult {
  queryHash: string;
  query: QueryRequest;
  status: QueryStatus;
  provider?: string;
  data?: NormalizedData;
  cache?: CacheMeta;
  credits?: number;
  requestId?: string;
  reason?: string;
}

export interface QueryLogEntry {
  queryHash: string;
  intent: Intent;
  subject: string;
  market: string;
  period: string;
  provider: string | null;
  status: QueryStatus;
  credits: number | null;
  createdAt: string;
}
