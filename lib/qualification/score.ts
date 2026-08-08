import { clamp, logScale, ratioScale, recencyScore } from "../opportunity/metrics.ts";
import {
  DEFAULT_WEIGHTS,
  PRIORITY_THRESHOLDS,
  type Factor,
  type QualificationContext,
  type QualificationResult,
} from "./types.ts";

export function computePriorityScore(
  row: Record<string, unknown>,
  context?: QualificationContext,
): { score: number; factors: Factor[]; productMatchConfidence: number } {
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

  values.push({
    id: "shipment_volume",
    label: "Shipment volume",
    value: logScale(totalShipments, 500),
    weight: w.shipmentVolume,
  });

  values.push({
    id: "shipment_recency",
    label: "Shipment recency",
    value: recencyScore(lsd),
    weight: w.shipmentRecency,
  });

  values.push({
    id: "supplier_diversity",
    label: "Supplier diversity",
    value: ratioScale(supplierCount, 5),
    weight: w.supplierDiversity,
  });

  let chinaSupplierValue = 0;
  if (typeof row.supplierNames === "object" && Array.isArray(row.supplierNames)) {
    const names = row.supplierNames as string[];
    const chinaHits = names.filter((s: string) =>
      /china|chinese|shenzhen|guangzhou|shanghai|ningbo|yiwu|foshan|dongguan|xiamen|tianjin|zhejiang|jiangsu|guangdong|fujian|shandong|wenzhou|kaiping|nanan|chaozhou|taizhou|crescent|regent|rin shing/i.test(s)
    ).length;
    chinaSupplierValue = supplierCount > 0
      ? ratioScale(chinaHits, Math.min(supplierCount, 3))
      : 0;
  }
  values.push({
    id: "supplier_china",
    label: "China supplier",
    value: chinaSupplierValue,
    weight: w.supplierChina,
  });

  values.push({
    id: "container_volume",
    label: "Container volume",
    value: logScale(containers, 50),
    weight: w.containerVolume,
  });

  values.push({
    id: "freight_value",
    label: "Freight value",
    value: logScale(freightUsd, 100000),
    weight: w.freightValue,
  });

  values.push({
    id: "identity_confidence",
    label: "Identity confidence",
    value: ratioScale(identityConfidence, 100),
    weight: w.identityConfidence,
  });

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
    else if (products.length > 0) productMatchConfidence = 30;
    else productMatchConfidence = 15;

    if (context.excludeKeywords?.length) {
      const excludeHits = context.excludeKeywords.filter(
        k => lowerProducts.includes(k.toLowerCase()),
      ).length;
      if (excludeHits > 0) {
        relevanceValue = clamp(relevanceValue - excludeHits * 20, 10, 100);
        productMatchConfidence = clamp(productMatchConfidence - excludeHits * 20, 5, 100);
      }
    }
  } else {
    relevanceValue = totalShipments > 0 ? 70 : 40;
    productMatchConfidence = totalShipments > 0 ? 50 : 25;
  }
  values.push({
    id: "product_relevance",
    label: "Product relevance",
    value: relevanceValue,
    weight: w.productRelevance,
  });

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
  values.push({
    id: "product_concentration",
    label: "Product concentration",
    value: concentrationValue,
    weight: w.productConcentration,
  });

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
  values.push({
    id: "data_coverage",
    label: "Data coverage",
    value: dataCoverageValue,
    weight: w.dataCoverage,
  });

  const factors: Factor[] = values.map(v => ({
    ...v,
    contribution: Math.round(v.value * v.weight / 100),
  }));

  const score = Math.round(factors.reduce((sum, f) => sum + f.contribution, 0));
  return { score: clamp(score, 0, 100), factors, productMatchConfidence };
}

export function priorityFromScore(score: number): "A" | "B" | "C" {
  if (score >= PRIORITY_THRESHOLDS.a) return "A";
  if (score >= PRIORITY_THRESHOLDS.b) return "B";
  return "C";
}
