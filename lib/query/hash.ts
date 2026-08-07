import type { QueryInput, QueryRequest } from "./types.ts";

const MONTH_PATTERN = /^\d{4}-\d{2}$/;

function parseMonth(value: string): Date | null {
  if (!MONTH_PATTERN.test(value)) return null;
  return new Date(Date.UTC(Number(value.slice(0, 4)), Number(value.slice(5, 7)) - 1, 1));
}

function formatMonth(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function rangeMonths(from: string, to: string): string[] {
  const start = parseMonth(from);
  const end = parseMonth(to);
  if (!start || !end) return [];
  const months: string[] = [];
  let current = start;
  while (current <= end && months.length < 36) {
    months.push(formatMonth(current));
    current = new Date(Date.UTC(current.getUTCFullYear(), current.getUTCMonth() + 1, 1));
  }
  return months;
}

export function normalizeQuery(input: QueryInput): QueryRequest {
  const subject = input.subject ?? input.product ?? "";
  let months: string[] = Array.isArray(input.months) ? [...input.months] : [];
  if (typeof input.period === "object" && input.period !== null) {
    months = rangeMonths(input.period.from, input.period.to);
  }
  const period = typeof input.period === "string" ? input.period.trim() : (input.period?.to || "").trim();

  const normalized: QueryRequest = {
    intent: input.intent as QueryRequest["intent"],
    subject: subject.trim().toLowerCase(),
    market: (input.market || "US").trim().toUpperCase(),
    period,
  };
  if (input.company) normalized.company = input.company.trim().toLowerCase();
  if (input.ranking) {
    const metric = input.ranking.metric || "shipment_count";
    normalized.ranking = { metric, limit: 50 };
  }
  if (input.flow) normalized.flow = input.flow;
  if (input.granularity) normalized.granularity = input.granularity;
  if (input.range) normalized.range = input.range;
  if (months.length) normalized.months = [...months].sort();
  return normalized;
}

export async function queryHash(query: QueryRequest): Promise<string> {
  const normalized = normalizeQuery(query);
  const input = JSON.stringify(normalized);
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return [...new Uint8Array(bytes)].map(value => value.toString(16).padStart(2, "0")).join("");
}
