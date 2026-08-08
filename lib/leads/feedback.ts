import type { LeadStatus } from "../qualification/types.ts";

export type OutcomeCode = "no_response" | "replied" | "interested" | "meeting_booked" | "quote_requested" | "not_fit" | "bounced" | "won" | "lost";
export type QualificationFeedback = "confirmed_fit" | "needs_review" | "disqualified";

export function leadStatusForOutcome(outcome: OutcomeCode): LeadStatus {
  if (outcome === "won" || outcome === "quote_requested") return "opportunity";
  if (outcome === "meeting_booked" || outcome === "interested") return "qualified";
  if (outcome === "replied" || outcome === "no_response") return "follow_up";
  if (outcome === "bounced") return "researching";
  if (outcome === "not_fit" || outcome === "lost") return "contacted";
  return "contacted";
}

export interface PipelineMetricInput {
  leadStatus: string | null;
  outcomeCode?: string | null;
  nextActionDue?: string | null;
}

export function computePipelineMetrics(rows: PipelineMetricInput[], today: string) {
  const leadCounts: Record<string, number> = {};
  const outcomeCounts: Record<string, number> = {};
  let overdue = 0;
  let dueToday = 0;
  for (const row of rows) {
    const leadStatus = row.leadStatus || "new";
    leadCounts[leadStatus] = (leadCounts[leadStatus] || 0) + 1;
    if (row.outcomeCode) outcomeCounts[row.outcomeCode] = (outcomeCounts[row.outcomeCode] || 0) + 1;
    if (row.nextActionDue && row.nextActionDue < today) overdue += 1;
    if (row.nextActionDue === today) dueToday += 1;
  }
  const contacted = (leadCounts.contacted || 0) + (leadCounts.follow_up || 0) + (leadCounts.qualified || 0) + (leadCounts.opportunity || 0);
  const positive = (outcomeCounts.interested || 0) + (outcomeCounts.meeting_booked || 0) + (outcomeCounts.quote_requested || 0) + (outcomeCounts.won || 0);
  return {totalLeads: rows.length, leadCounts, outcomeCounts, overdue, dueToday, contacted, positive, positiveRate: contacted ? Math.round(positive / contacted * 100) : 0};
}
