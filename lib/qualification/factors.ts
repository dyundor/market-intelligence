import { POSITIVE_REASONS, RISK_REASONS, type QualificationContext, type QualificationResult } from "./types.ts";
import { computePriorityScore, priorityFromScore } from "./score.ts";

function gatherPositiveFactors(
  row: Record<string, unknown>,
  factors: Map<string, number>,
): string[] {
  const out: string[] = [];

  const totalShipments = Number(row.total_shipments) || 0;
  const supplierCount = Number(row.supplier_count) || 0;
  const containers = Number(row.selected_month_containers) || 0;
  const freightUsd = Number(row.selected_month_freight_usd) || 0;
  const lsd = typeof row.latest_shipment_date === "string" ? row.latest_shipment_date : null;
  const identityConfidence = Number(row.identity_confidence) || 0;

  if (totalShipments >= 50) out.push(POSITIVE_REASONS.frequent_importer);
  if (lsd) {
    const days = (Date.now() - new Date(lsd).getTime()) / 86_400_000;
    if (days >= 0 && days <= 180) out.push(POSITIVE_REASONS.recent_imports);
  }
  if (supplierCount >= 3) out.push(POSITIVE_REASONS.multiple_suppliers);
  if (containers >= 1) out.push(POSITIVE_REASONS.containerized_freight);
  if (freightUsd >= 10000) out.push(POSITIVE_REASONS.high_order_value);

  const relevance = factors.get("product_relevance");
  if (relevance !== undefined && relevance >= 50) out.push(POSITIVE_REASONS.product_focus);

  if (identityConfidence >= 80) out.push(POSITIVE_REASONS.high_identity);

  return out;
}

function gatherRiskFactors(row: Record<string, unknown>): string[] {
  const out: string[] = [];

  const totalShipments = Number(row.total_shipments) || 0;
  const supplierCount = Number(row.supplier_count) || 0;
  const containers = Number(row.selected_month_containers) || 0;
  const lsd = typeof row.latest_shipment_date === "string" ? row.latest_shipment_date : null;
  const websiteStatus = typeof row.website_status === "string" ? row.website_status : "";
  const identityConfidence = Number(row.identity_confidence) || 0;

  if (totalShipments < 5) out.push(RISK_REASONS.few_shipments);
  if (!lsd || new Date(lsd).getTime() < Date.now() - 365 * 86400000)
    out.push(RISK_REASONS.no_recent_activity);
  if (supplierCount === 1) out.push(RISK_REASONS.single_supplier);
  if (!containers) out.push(RISK_REASONS.no_containers);
  if (websiteStatus !== "verified_company_site" && websiteStatus !== "verified_forwarder_site")
    out.push(RISK_REASONS.missing_website);
  if (identityConfidence > 0 && identityConfidence < 70)
    out.push(RISK_REASONS.low_identity);

  if (!totalShipments)
    out.push(RISK_REASONS.no_shipment_data);

  if (totalShipments >= 50 && supplierCount === 1)
    out.push(RISK_REASONS.missing_suppliers);

  return out;
}

export function qualifyBuyer(
  row: Record<string, unknown>,
  context?: QualificationContext,
): QualificationResult {
  const { score, factors } = computePriorityScore(row, context);
  const priority = priorityFromScore(score);

  const factorMap = new Map(factors.map(f => [f.id, f.value]));

  return {
    priority,
    qualificationScore: score,
    positiveFactors: gatherPositiveFactors(row, factorMap),
    riskFactors: gatherRiskFactors(row),
    factors,
  };
}
