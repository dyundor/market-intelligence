import type { PlannedQuery, ProviderKind, QueryRequest } from "../query/types";

export interface ProviderCapability {
  id: string;
  kind: ProviderKind;
  label: string;
  canHandle(query: QueryRequest): boolean;
  rejectReason(query: QueryRequest): string | null;
  estimateCredits(query: QueryRequest): number;
}

export interface Provider {
  capability: ProviderCapability;
  fetch(query: QueryRequest): Promise<unknown>;
}

export interface ProviderRegistry {
  list(): Provider[];
  route(plan: PlannedQuery): Provider | null;
}
