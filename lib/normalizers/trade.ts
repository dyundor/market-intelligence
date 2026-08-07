import type { NormalizedData } from "../query/types.ts";

export function normalizeTrade(raw: unknown): NormalizedData {
  const payload = raw as { records?: Array<{ code: string; name: string; tradeValue: number; netWeightKg: number; isEstimated: boolean }>; reporter?: string };
  const records = payload?.records || [];
  const total = records.reduce((sum, row) => sum + (Number(row.tradeValue) || 0), 0);
  return {
    kind: "trade",
    metric: {
      period: "mock",
      value: total,
      partners: records.map(row => ({ code: row.code, name: row.name, value: Number(row.tradeValue) || 0, share: total ? (Number(row.tradeValue) || 0) / total : 0 })),
    },
  };
}

export function normalizeCompanies(raw: unknown): NormalizedData {
  const payload = raw as { companies?: Array<{ id: string; name: string; country: string; website: string | null; shipments: number }> };
  return {
    kind: "companies",
    companies: (payload?.companies || []).map(row => ({
      id: row.id,
      name: row.name,
      country: row.country,
      website: row.website || null,
      shipments: Number(row.shipments) || 0,
    })),
  };
}
