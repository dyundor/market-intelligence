import type { NormalizedData, SupplierDiscovery, TradeMetric } from "../query/types.ts";
import type { ComtradeView } from "../providers/comtrade/provider.ts";

export function normalizeTrade(view: ComtradeView): NormalizedData {
  const metric: TradeMetric = {
    source: view.source,
    sourceUrl: view.sourceUrl,
    access: view.access,
    market: view.market,
    product: view.product,
    flow: view.flow === "X" ? "export" : "import",
    granularity: view.granularity === "A" ? "annual" : "monthly",
    range: view.range,
    availabilityStatus: view.availabilityStatus,
    requestedPeriod: view.requestedPeriod,
    period: view.period,
    latestReportedPeriod: view.latestReportedPeriod,
    recordCount: view.recordCount,
    hsCode: view.hsCode,
    tradeValue: view.tradeValue,
    netWeightKg: view.netWeightKg,
    isNetWeightEstimated: view.isNetWeightEstimated,
    series: view.series,
    partners: view.partners,
    fetchedAt: view.fetchedAt,
    licenseNote: view.licenseNote,
  };
  return { kind: "trade", metric };
}

export function normalizeDiscovery(view: SupplierDiscovery): NormalizedData {
  return { kind: "discovery", discovery: view };
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
