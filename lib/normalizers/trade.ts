import type { NormalizedData, QueryRequest, SupplierDiscovery, TradeMetric } from "../query/types.ts";
import type { ComtradeView } from "../providers/comtrade/provider.ts";
import { rankBuyers } from "../ranking/engine.ts";
import type { BuyerRanking } from "../ranking/types.ts";
import { qualifyBuyer } from "../qualification/factors.ts";
import { resolveProduct } from "../products/resolver.ts";

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

export function normalizeRanking(view: SupplierDiscovery, query: QueryRequest): NormalizedData {
  const ranking: BuyerRanking = rankBuyers(view, {
    limit: query.ranking?.limit || 20,
    metric: query.ranking?.metric || "shipment_count",
  });
  const productCategory = resolveProduct(query.subject);
  const qualificationContext = productCategory
    ? { productCategory: productCategory.id, productKeywords: [...productCategory.keywords, ...productCategory.aliases], excludeKeywords: productCategory.excludeKeywords }
    : undefined;
  for (const buyer of ranking.ranked) {
    const q = qualifyBuyer(buyer, qualificationContext);
    buyer.priority = q.priority;
    buyer.qualificationScore = q.qualificationScore;
    buyer.productMatchConfidence = q.productMatchConfidence;
    buyer.productMatch = q.productMatch;
    buyer.buyerType = q.buyerType;
    buyer.classificationReason = q.classificationReason;
    buyer.positiveFactors = q.positiveFactors;
    buyer.riskFactors = q.riskFactors;
  }
  return { kind: "ranking", ranking };
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
