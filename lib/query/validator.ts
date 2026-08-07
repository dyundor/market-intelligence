import type { QueryRequest, QueryValidation } from "./types.ts";

const INTENTS = new Set(["buyer_ranking", "supplier_ranking", "trade_trend"]);
const FLOWS = new Set(["import", "export"]);
const GRANULARITIES = new Set(["monthly", "annual"]);

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
  if (query.flow !== undefined && (typeof query.flow !== "string" || !FLOWS.has(query.flow))) errors.push("flow must be import or export");
  if (query.granularity !== undefined && (typeof query.granularity !== "string" || !GRANULARITIES.has(query.granularity))) errors.push("granularity must be monthly or annual");
  if (query.range !== undefined && (typeof query.range !== "number" || query.range < 1 || query.range > 36)) errors.push("range must be between 1 and 36");
  if (query.months !== undefined) {
    if (!Array.isArray(query.months) || query.months.length > 36 || query.months.some(month => typeof month !== "string" || !/^\d{4}-\d{2}$/.test(month))) {
      errors.push("months must be an array of YYYY-MM strings (max 36)");
    }
  }
  return { ok: errors.length === 0, errors };
}
