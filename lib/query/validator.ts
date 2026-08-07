import type { QueryInput, QueryValidation } from "./types.ts";
import { RANKING_METRICS } from "../ranking/metrics.ts";

const INTENTS = new Set(["buyer_ranking", "supplier_ranking", "trade_trend", "buyer_profile"]);
const FLOWS = new Set(["import", "export"]);
const GRANULARITIES = new Set(["monthly", "annual"]);
const MONTH_PATTERN = /^\d{4}-\d{2}$/;

function monthDiff(from: string, to: string): number {
  const fromYear = Number(from.slice(0, 4));
  const fromMonth = Number(from.slice(5, 7));
  const toYear = Number(to.slice(0, 4));
  const toMonth = Number(to.slice(5, 7));
  return (toYear - fromYear) * 12 + (toMonth - fromMonth);
}

export function validateQuery(input: unknown): QueryValidation {
  const errors: string[] = [];
  if (!input || typeof input !== "object") return { ok: false, errors: ["Query must be an object"] };
  const query = input as Partial<QueryInput>;
  if (typeof query.intent !== "string" || !INTENTS.has(query.intent)) errors.push(`intent must be one of: ${[...INTENTS].join(", ")}`);
  if (query.intent === "buyer_profile") {
    if (typeof query.company !== "string" || !query.company.trim()) errors.push("company is required for buyer_profile");
    return { ok: errors.length === 0, errors };
  }
  const subject = query.subject ?? query.product;
  if (typeof subject !== "string" || !subject.trim()) errors.push("subject or product is required");
  if (typeof query.market !== "string" || !/^[A-Za-z]{2}$/.test(query.market.trim())) errors.push("market must be a two-letter ISO code");
  if (typeof query.period === "object" && query.period !== null) {
    const from = query.period.from;
    const to = query.period.to;
    if (typeof from !== "string" || !MONTH_PATTERN.test(from) || typeof to !== "string" || !MONTH_PATTERN.test(to)) {
      errors.push("period.from and period.to must be YYYY-MM");
    } else {
      const diff = monthDiff(from, to);
      if (diff < 0) errors.push("period.from must not be after period.to");
      else if (diff > 35) errors.push("period range must be at most 36 months");
    }
  } else if (typeof query.period !== "string" || !MONTH_PATTERN.test(query.period.trim())) {
    errors.push("period must be YYYY-MM or {from, to}");
  }
  if (query.ranking !== undefined) {
    if (typeof query.ranking !== "object" || query.ranking === null) errors.push("ranking must be an object");
    else if (typeof query.ranking.limit !== "number" || query.ranking.limit < 1 || query.ranking.limit > 200) errors.push("ranking.limit must be between 1 and 200");
    else if (query.ranking.metric !== undefined && (typeof query.ranking.metric !== "string" || !RANKING_METRICS.includes(query.ranking.metric as typeof RANKING_METRICS[number]))) errors.push(`ranking.metric must be one of: ${RANKING_METRICS.join(", ")}`);
  }
  if (query.flow !== undefined && (typeof query.flow !== "string" || !FLOWS.has(query.flow))) errors.push("flow must be import or export");
  if (query.granularity !== undefined && (typeof query.granularity !== "string" || !GRANULARITIES.has(query.granularity))) errors.push("granularity must be monthly or annual");
  if (query.range !== undefined && (typeof query.range !== "number" || query.range < 1 || query.range > 36)) errors.push("range must be between 1 and 36");
  if (query.months !== undefined) {
    if (!Array.isArray(query.months) || query.months.length > 36 || query.months.some(month => typeof month !== "string" || !MONTH_PATTERN.test(month))) {
      errors.push("months must be an array of YYYY-MM strings (max 36)");
    }
  }
  return { ok: errors.length === 0, errors };
}
