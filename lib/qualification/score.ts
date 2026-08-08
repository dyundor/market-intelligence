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
): { score: number; factors: Factor[] } {
  const totalShipments = Number(row.total_shipments) || 0;
  const supplierCount = Number(row.supplier_count) || 0;
  const containers = Number(row.selected_month_containers) || 0;
  const freightUsd = Number(row.selected_month_freight_usd) || 0;
  const lsd = typeof row.latest_shipment_date === "string" ? row.latest_shipment_date : null;
  const products = typeof row.products === "string" ? row.products : "";
  const identityConfidence = Number(row.identity_confidence) || 0;
  const weights = DEFAULT_WEIGHTS;

  const w = weights;
  const values: Array<Omit<Factor, "contribution">> = [];

  values.push({
    id: "shipment_volume",
    label: "Shipment volume",
    value: logScale(totalShipments, 100),
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
  if (context?.productKeywords?.length) {
    const lowerProducts = products.toLowerCase();
    const keywordMatches = context.productKeywords.filter(
      k => lowerProducts.includes(k.toLowerCase()),
    ).length;
    relevanceValue = clamp(keywordMatches * 25, 30, 100);
  } else {
    relevanceValue = totalShipments > 0 ? 70 : 40;
  }
  values.push({
    id: "product_relevance",
    label: "Product relevance",
    value: relevanceValue,
    weight: w.productRelevance,
  });

  const factors: Factor[] = values.map(v => ({
    ...v,
    contribution: Math.round(v.value * v.weight / 100),
  }));

  const score = Math.round(factors.reduce((sum, f) => sum + f.contribution, 0));
  return { score: clamp(score, 0, 100), factors };
}

export function priorityFromScore(score: number): "A" | "B" | "C" {
  if (score >= PRIORITY_THRESHOLDS.a) return "A";
  if (score >= PRIORITY_THRESHOLDS.b) return "B";
  return "C";
}
