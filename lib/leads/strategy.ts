import type {
  ConfidenceLevel,
  LeadRecord,
  LeadStatus,
  OutreachStrategy,
  QualificationResult,
} from "../qualification/types.ts";

interface StrategyInput {
  qualification: QualificationResult;
  totalShipments: number;
  chinaSupplierCount: number;
  chinaSupplierConfirmed: boolean;
}

function determineStrategy(input: StrategyInput): OutreachStrategy {
  const { qualification } = input;

  if (qualification.priority === "C" || qualification.productMatch === "LOW") {
    return "Research Only";
  }

  if (input.chinaSupplierCount > 0) {
    if (qualification.priority === "A") return "OEM/ODM Pitch";
    return "Distribution Partnership";
  }

  if (qualification.priority === "A") return "OEM/ODM Pitch";
  if (qualification.priority === "B") return "Distribution Partnership";

  return "Research Only";
}

function determineProducts(qualification: QualificationResult): string {
  switch (qualification.productMatch) {
    case "HIGH":
      return "Full Bathroom Collection";
    case "MEDIUM":
      return "Basin Faucets + Shower Systems";
    default:
      return "Bathroom Faucets";
  }
}

function computeConfidence(input: StrategyInput): ConfidenceLevel {
  const { totalShipments, chinaSupplierConfirmed } = input;
  let score = 0;

  if (totalShipments > 500) score += 40;
  else if (totalShipments > 100) score += 35;
  else if (totalShipments > 50) score += 25;
  else if (totalShipments > 0) score += 15;
  else score += 5;

  if (chinaSupplierConfirmed) score += 25;
  else if (input.chinaSupplierCount > 0) score += 15;
  else score += 5;

  score += 15;

  const { qualification } = input;
  if (qualification.buyerType !== "Unknown") {
    score += qualification.buyerType !== "General Plumbing" ? 15 : 10;
  } else {
    score += 5;
  }

  if (score >= 80) return "HIGH";
  if (score >= 55) return "MEDIUM";
  return "LOW";
}

function computeCommercialFit(qualification: QualificationResult): number {
  return Math.round(qualification.qualificationScore * 0.85);
}

function computeOutreachScore(
  qualification: QualificationResult,
  input: StrategyInput,
): number {
  let factor = 0;
  if (qualification.priority === "A") factor += 40;
  else if (qualification.priority === "B") factor += 25;
  else factor += 10;

  if (qualification.productMatch === "HIGH") factor += 25;
  else if (qualification.productMatch === "MEDIUM") factor += 15;
  else factor += 5;

  if (input.chinaSupplierConfirmed) factor += 25;
  else if (input.chinaSupplierCount > 0) factor += 15;

  const websiteRisk = qualification.riskFactors.find(r =>
    r.includes("No verified company website"),
  );
  if (!websiteRisk) factor += 10;

  return Math.min(100, factor);
}

export function generateLeadStrategy(
  qualification: QualificationResult,
  row: Record<string, unknown>,
): LeadRecord {
  const totalShipments = Number(row.total_shipments ?? row.totalShipments) || 0;
  const chinaSupplierCount = qualification.supplierIntelligence.chinaSupplierCount;

  const chinaSupplierConfirmed =
    chinaSupplierCount > 0 &&
    qualification.supplierIntelligence.chinaSupplierConfidence >= 50;

  const input: StrategyInput = {
    qualification,
    totalShipments,
    chinaSupplierCount,
    chinaSupplierConfirmed,
  };

  const confidence = computeConfidence(input);
  // Trade evidence can make a buyer worth researching, but it does not make the
  // buyer contact-ready. That transition happens only after a verified contact
  // method is stored.
  const leadStatus: LeadStatus = "researching";

  return {
    companyId: String(row.id || row.buyerId || ""),
    leadStatus,
    outreachStrategy: determineStrategy(input),
    recommendedProducts: determineProducts(qualification),
    confidence,
    commercialFitScore: computeCommercialFit(qualification),
    outreachScore: computeOutreachScore(qualification, input),
  };
}
