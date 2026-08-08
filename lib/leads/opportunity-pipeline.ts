export interface OpportunityInput {
  leadStatus?: string | null;
  opportunityValueUsd?: number | null;
  opportunityProbability?: number | null;
}

export interface OpportunityTaskInput extends OpportunityInput {
  companyId: string;
  companyName: string;
  outcomeCode?: string | null;
  nextAction?: string | null;
  nextActionDue?: string | null;
  expectedCloseDate?: string | null;
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
    if (row.leadStatus === "disqualified" || !validateOpportunityValue(row.opportunityValueUsd) || row.opportunityValueUsd === 0) continue;
    opportunityCount += 1;
    pipelineValueUsd += row.opportunityValueUsd;
    const probability = validateOpportunityProbability(row.opportunityProbability) ? row.opportunityProbability : 0;
    weightedPipelineValueUsd += Math.round(row.opportunityValueUsd * probability / 100);
  }
  return {opportunityCount, pipelineValueUsd, weightedPipelineValueUsd};
}

export function buildSalesPriorityQueue(rows: OpportunityTaskInput[], today: string) {
  const terminalOutcomes = new Set(["won", "lost", "not_fit"]);
  return rows.flatMap(row => {
    const hasValue = validateOpportunityValue(row.opportunityValueUsd) && row.opportunityValueUsd > 0;
    const probability = validateOpportunityProbability(row.opportunityProbability) ? row.opportunityProbability : 0;
    const weightedValueUsd = hasValue ? Math.round(row.opportunityValueUsd * probability / 100) : 0;
    if (row.leadStatus === "disqualified" || terminalOutcomes.has(row.outcomeCode || "")) return [];
    if (row.nextActionDue) return [{...row,weightedValueUsd,timing:row.nextActionDue < today ? "overdue" as const : row.nextActionDue === today ? "today" as const : "upcoming" as const}];
    if (hasValue) {
      return [{...row,nextAction:"Schedule the next sales action",nextActionDue:null,weightedValueUsd,timing:"unscheduled" as const}];
    }
    return [];
  }).sort((a,b) => {
    const rank = {overdue:0,today:1,unscheduled:2,upcoming:3};
    const timingDifference = rank[a.timing] - rank[b.timing];
    if (timingDifference) return timingDifference;
    const dueDifference = String(a.nextActionDue || "").localeCompare(String(b.nextActionDue || ""));
    return dueDifference || b.weightedValueUsd - a.weightedValueUsd || a.companyName.localeCompare(b.companyName);
  });
}
