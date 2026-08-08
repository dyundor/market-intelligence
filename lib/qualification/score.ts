import { clamp, ratioScale, recencyScore } from "../opportunity/metrics.ts";
import {
  DEFAULT_WEIGHTS,
  PRIORITY_THRESHOLDS,
  type Factor,
  type QualificationContext,
  type QualificationResult,
  type BuyerSizeTier,
} from "./types.ts";

/** Tiered shipment scoring — creates real gaps between size tiers */
function tieredShipmentScore(total: number): { value: number; sizeTier: BuyerSizeTier } {
  if (total >= 500) return { value: 100, sizeTier: "Enterprise" };
  if (total >= 100) return { value: 70, sizeTier: "Mid-market" };
  if (total >= 20)  return { value: 40, sizeTier: "Small" };
  return { value: 15, sizeTier: "Small" };
}

export function computePriorityScore(
  row: Record<string, unknown>,
  context?: QualificationContext,
): { score: number; factors: Factor[]; productMatchConfidence: number; buyerSizeTier: BuyerSizeTier } {
  const totalShipments = Number(row.total_shipments) || 0;
  const supplierCount = Number(row.supplier_count) || 0;
  const containers = Number(row.selected_month_containers) || 0;
  const freightUsd = Number(row.selected_month_freight_usd) || 0;
  const lsd = typeof row.latest_shipment_date === "string" ? row.latest_shipment_date : null;
  const products = typeof row.products === "string" ? row.products : "";
  const identityConfidence = Number(row.identity_confidence) || 0;
  const searchQuery = typeof row.search_query === "string" ? row.search_query : "";
  const weights = DEFAULT_WEIGHTS;

  const w = weights;
  const values: Array<Omit<Factor, "contribution">> = [];

  // ── 1. Tiered shipment volume ──
  const { value: shipValue, sizeTier } = tieredShipmentScore(totalShipments);
  values.push({ id: "shipment_volume", label: "Shipment volume", value: shipValue, weight: w.shipmentVolume });

  // ── 2. Shipment recency ──
  values.push({ id: "shipment_recency", label: "Shipment recency", value: recencyScore(lsd), weight: w.shipmentRecency });

  // ── 3. Supplier diversity ──
  values.push({ id: "supplier_diversity", label: "Supplier diversity", value: ratioScale(supplierCount, 5), weight: w.supplierDiversity });

  // ── 4. China supplier ──
  let chinaValue = 0;
  if (typeof row.supplierNames === "object" && Array.isArray(row.supplierNames)) {
    const names = row.supplierNames as string[];
    const chinaHits = names.filter((s: string) =>
      /china|chinese|shenzhen|guangzhou|shanghai|ningbo|yiwu|foshan|dongguan|xiamen|tianjin|zhejiang|jiangsu|guangdong|fujian|shandong|wenzhou|kaiping|nanan|chaozhou|taizhou|crescent|regent|rin shing/i.test(s)
    ).length;
    chinaValue = supplierCount > 0 ? ratioScale(chinaHits, Math.min(supplierCount, 3)) : 0;
  }
  values.push({ id: "supplier_china", label: "China supplier", value: chinaValue, weight: w.supplierChina });

  // ── 5-6. Container + Freight (placeholder, always 0 currently) ──
  values.push({ id: "container_volume", label: "Container volume", value: 0, weight: w.containerVolume });
  values.push({ id: "freight_value", label: "Freight value", value: 0, weight: w.freightValue });

  // ── 7. Identity confidence ──
  values.push({ id: "identity_confidence", label: "Identity confidence", value: ratioScale(identityConfidence, 100), weight: w.identityConfidence });

  // ── 8. Product relevance ──
  let relevanceValue = 70;
  let productMatchConfidence = 50;
  if (context?.productKeywords?.length) {
    const lowerProducts = products.toLowerCase();
    const keywordMatches = context.productKeywords.filter(
      k => lowerProducts.includes(k.toLowerCase()),
    ).length;
    relevanceValue = clamp(keywordMatches * 25, 30, 100);
    if (keywordMatches >= 3) productMatchConfidence = 95;
    else if (keywordMatches === 2) productMatchConfidence = 80;
    else if (keywordMatches === 1) productMatchConfidence = 60;
    else productMatchConfidence = 30;
    if (context.excludeKeywords?.length) {
      const excludeHits = context.excludeKeywords.filter(
        k => lowerProducts.includes(k.toLowerCase()),
      ).length;
      if (excludeHits > 0) {
        relevanceValue = clamp(relevanceValue - excludeHits * 20, 10, 100);
        productMatchConfidence = clamp(productMatchConfidence - excludeHits * 20, 5, 100);
      }
    }
  }
  values.push({ id: "product_relevance", label: "Product relevance", value: relevanceValue, weight: w.productRelevance });

  // ── 9. Product concentration ──
  let concentrationValue = 50;
  if (context?.productKeywords?.length) {
    const lowerProducts = products.toLowerCase();
    const keywordMatches = context.productKeywords.filter(
      k => lowerProducts.includes(k.toLowerCase()),
    ).length;
    const excludeHits = (context.excludeKeywords || []).filter(
      k => lowerProducts.includes(k.toLowerCase()),
    ).length;
    const hasKitchen = /kitchen/i.test(lowerProducts);
    concentrationValue = clamp(keywordMatches * 25 - excludeHits * 20 - (hasKitchen ? 15 : 0), 10, 100);
  }
  values.push({ id: "product_concentration", label: "Product concentration", value: concentrationValue, weight: w.productConcentration });

  // ── 10. Data coverage ──
  const isBathroomQuery = searchQuery && (
    searchQuery.includes("faucet") || searchQuery.includes("shower") ||
    searchQuery.includes("龙头") || searchQuery.includes("花洒") ||
    searchQuery.includes("bathroom") || searchQuery.includes("basin") ||
    searchQuery.includes("lavatory") || searchQuery.includes("vanity") ||
    searchQuery.includes("tap") || searchQuery.includes("mixer") ||
    searchQuery.includes("淋浴")
  );
  let dataCoverageValue = 10;
  if (totalShipments > 0 && isBathroomQuery) dataCoverageValue = 100;
  else if (totalShipments > 0) dataCoverageValue = 80;
  else if (isBathroomQuery) dataCoverageValue = 50;
  else if (identityConfidence >= 80) dataCoverageValue = 20;
  values.push({ id: "data_coverage", label: "Data coverage", value: dataCoverageValue, weight: w.dataCoverage });

  const factors: Factor[] = values.map(v => ({
    ...v,
    contribution: Math.round(v.value * v.weight / 100),
  }));

  const baseScore = Math.round(factors.reduce((sum, f) => sum + f.contribution, 0));

  // ── 11. Negative signal penalties ──
  let penalty = 0;

  // Check for mixed/kitchen in products
  const lowerProducts = products.toLowerCase();
  const hasKitchen = /kitchen/i.test(lowerProducts);
  const hasSauna = /sauna/i.test(lowerProducts);

  if (hasKitchen && totalShipments > 0) penalty += 5;
  if (hasSauna) penalty += 8;
  if (totalShipments < 20 && totalShipments > 0) penalty += 3;
  if (identityConfidence > 0 && identityConfidence < 70) penalty += 3;

  const score = clamp(baseScore - penalty, 0, 100);
  return { score, factors, productMatchConfidence, buyerSizeTier: sizeTier };
}

export function priorityFromScore(score: number): "A" | "B" | "C" {
  if (score >= PRIORITY_THRESHOLDS.a) return "A";
  if (score >= PRIORITY_THRESHOLDS.b) return "B";
  return "C";
}
