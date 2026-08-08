export interface OpportunityInput {
  leadStatus?: string | null;
  opportunityValueUsd?: number | null;
  opportunityProbability?: number | null;
}

export function validateOpportunityValue(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

export function validateOpportunityProbability(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= 100;
}

export function validateExpectedCloseDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value;
}

export function computeOpportunityMetrics(rows: OpportunityInput[]) {
  let opportunityCount = 0;
  let pipelineValueUsd = 0;
  let weightedPipelineValueUsd = 0;
  for (const row of rows) {
    if (row.leadStatus === "disqualified" || !validateOpportunityValue(row.opportunityValueUsd)) continue;
    opportunityCount += 1;
    pipelineValueUsd += row.opportunityValueUsd;
    const probability = validateOpportunityProbability(row.opportunityProbability) ? row.opportunityProbability : 0;
    weightedPipelineValueUsd += Math.round(row.opportunityValueUsd * probability / 100);
  }
  return {opportunityCount, pipelineValueUsd, weightedPipelineValueUsd};
}
