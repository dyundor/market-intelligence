import type { ProviderKind, QueryRequest } from "../../query/types.ts";
import type { ProviderCapability } from "../types.ts";
import { resolveProduct } from "../../products/resolver.ts";

export function productDescription(subject: string): string {
  return resolveProduct(subject)?.description || subject;
}

export function rankCount(query: QueryRequest): number {
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

export const importYetiWebCapability: ProviderCapability = {
  id: "importyeti_web",
  kind: "free",
  label: "ImportYeti free web data (stored company-level records)",
  canHandle(query) {
    return query.intent === "buyer_ranking";
  },
  rejectReason(query) {
    if (query.market !== "US") return "Stored ImportYeti web data currently covers US import records only";
    if (query.intent !== "buyer_ranking") return "ImportYeti web data provides company-level records, not country aggregates";
    return null;
  },
  estimateCredits() {
    return 0;
  },
};

export function mockProviderKind(): ProviderKind {
  return "free";
}
