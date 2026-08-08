export function validateQualificationText(value: unknown): value is string {
  return typeof value === "string" && value.trim().length <= 1000;
}

export function validateQualificationQuantity(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

export function quoteReadiness(input: {
  targetMarket?: string | null;
  requiredCertifications?: string | null;
  estimatedAnnualUnits?: number | null;
  targetMoq?: number | null;
  quoteRequirements?: string | null;
}) {
  const missing: string[] = [];
  if (!input.targetMarket?.trim()) missing.push("target_market");
  if (!input.requiredCertifications?.trim()) missing.push("required_certifications");
  if (!validateQualificationQuantity(input.estimatedAnnualUnits) || input.estimatedAnnualUnits === 0) missing.push("estimated_annual_units");
  if (!validateQualificationQuantity(input.targetMoq) || input.targetMoq === 0) missing.push("target_moq");
  if (!input.quoteRequirements?.trim()) missing.push("quote_requirements");
  return {ready:missing.length===0,missing};
}
