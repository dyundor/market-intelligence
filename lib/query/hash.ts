import type { QueryRequest } from "./types.ts";

export function normalizeQuery(query: QueryRequest): QueryRequest {
  const normalized: QueryRequest = {
    intent: query.intent,
    subject: query.subject.trim().toLowerCase(),
    market: query.market.trim().toUpperCase(),
    period: query.period.trim(),
  };
  if (query.ranking) {
    const metric = query.ranking.metric || "shipment_count";
    normalized.ranking = { metric, limit: 50 };
  }
  if (query.flow) normalized.flow = query.flow;
  if (query.granularity) normalized.granularity = query.granularity;
  if (query.range) normalized.range = query.range;
  if (query.months?.length) normalized.months = [...query.months].sort();
  return normalized;
}

export async function queryHash(query: QueryRequest): Promise<string> {
  const normalized = normalizeQuery(query);
  const input = JSON.stringify(normalized);
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return [...new Uint8Array(bytes)].map(value => value.toString(16).padStart(2, "0")).join("");
}
