import type { ProviderKind, QueryRequest } from "../../query/types.ts";
import type { ProviderCapability } from "../types.ts";

export const PRODUCT_HINTS: Record<string, string> = {
  faucet: "Taps, faucets and valves",
  valve: "Taps, faucets and valves",
  shower: "Plastic baths and shower trays",
  ceramic: "Porcelain sanitary ware",
  sanitary: "Iron and steel sanitary ware",
};

function productDescription(subject: string): string {
  return PRODUCT_HINTS[subject] || subject;
}

function rankCount(query: QueryRequest): number {
  return query.ranking?.limit || 20;
}

export const comtradeCapability: ProviderCapability = {
  id: "comtrade",
  kind: "free",
  label: "UN Comtrade (official customs statistics)",
  canHandle(query) {
    return query.intent === "trade_trend";
  },
  rejectReason(query) {
    if (query.intent !== "trade_trend") return "Comtrade reports country/HS-level aggregates and cannot identify specific companies";
    return null;
  },
  estimateCredits() {
    return 0;
  },
};

export const importYetiCapability: ProviderCapability = {
  id: "importyeti",
  kind: "paid",
  label: "ImportYeti (company-level US import records)",
  canHandle(query) {
    return query.intent === "buyer_ranking" || query.intent === "supplier_ranking";
  },
  rejectReason(query) {
    if (query.market !== "US") return "ImportYeti mock currently covers US import records only";
    if (query.intent !== "buyer_ranking" && query.intent !== "supplier_ranking") return "ImportYeti provides company-level records, not country aggregates";
    return null;
  },
  estimateCredits(query) {
    if (query.intent === "buyer_ranking") return 0.8 * Math.max(1, Math.ceil(rankCount(query) / 20));
    return 0.6 * Math.max(1, Math.ceil(rankCount(query) / 20));
  },
};

export function mockProviderKind(): ProviderKind {
  return "free";
}

export { productDescription, rankCount };
