import type { QueryRequest } from "./types.ts";

export function normalizeQuery(query: QueryRequest): QueryRequest {
  return {
    intent: query.intent,
    subject: query.subject.trim().toLowerCase(),
    market: query.market.trim().toUpperCase(),
    period: query.period.trim(),
    ranking: query.ranking ? { limit: query.ranking.limit } : undefined,
  };
}

export async function queryHash(query: QueryRequest): Promise<string> {
  const normalized = normalizeQuery(query);
  const input = JSON.stringify(normalized);
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return [...new Uint8Array(bytes)].map(value => value.toString(16).padStart(2, "0")).join("");
}
