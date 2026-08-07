import type { QueryRequest, QueryValidation } from "./types.ts";

const INTENTS = new Set(["buyer_ranking", "supplier_ranking", "trade_trend"]);

export function validateQuery(input: unknown): QueryValidation {
  const errors: string[] = [];
  if (!input || typeof input !== "object") return { ok: false, errors: ["Query must be an object"] };
  const query = input as Partial<QueryRequest>;
  if (typeof query.intent !== "string" || !INTENTS.has(query.intent)) errors.push(`intent must be one of: ${[...INTENTS].join(", ")}`);
  if (typeof query.subject !== "string" || !query.subject.trim()) errors.push("subject is required");
  if (typeof query.market !== "string" || !/^[A-Za-z]{2}$/.test(query.market.trim())) errors.push("market must be a two-letter ISO code");
  if (typeof query.period !== "string" || !/^\d{4}-\d{2}$/.test(query.period.trim())) errors.push("period must be YYYY-MM");
  if (query.ranking !== undefined) {
    if (typeof query.ranking !== "object" || query.ranking === null) errors.push("ranking must be an object");
    else if (typeof query.ranking.limit !== "number" || query.ranking.limit < 1 || query.ranking.limit > 200) errors.push("ranking.limit must be between 1 and 200");
  }
  return { ok: errors.length === 0, errors };
}
