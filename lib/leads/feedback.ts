import type { LeadStatus } from "../qualification/types.ts";
import { addBusinessDays } from "./sales-task.ts";

export type OutcomeCode = "no_response" | "replied" | "interested" | "meeting_booked" | "quote_requested" | "quote_sent" | "not_fit" | "bounced" | "won" | "lost";
export type QualificationFeedback = "confirmed_fit" | "needs_review" | "disqualified";

export function leadStatusForOutcome(outcome: OutcomeCode): LeadStatus {
  if (outcome === "won" || outcome === "quote_requested" || outcome === "quote_sent") return "opportunity";
  if (outcome === "meeting_booked" || outcome === "interested") return "qualified";
  if (outcome === "replied" || outcome === "no_response") return "follow_up";
  if (outcome === "bounced") return "researching";
  if (outcome === "not_fit") return "disqualified";
  if (outcome === "lost") return "contacted";
  return "contacted";
}

export function defaultFollowUpForOutcome(outcome: OutcomeCode, today: string): {nextAction: string; nextActionDue: string} | null {
  const defaults: Partial<Record<OutcomeCode, {nextAction: string; businessDays: number}>> = {
    no_response: {nextAction:"Send a concise follow-up", businessDays:3},
    replied: {nextAction:"Review the reply and respond", businessDays:1},
    interested: {nextAction:"Qualify buyer needs and propose the next step", businessDays:1},
    meeting_booked: {nextAction:"Prepare buyer meeting brief", businessDays:1},
    quote_requested: {nextAction:"Prepare and send quotation", businessDays:1},
    quote_sent: {nextAction:"Follow up on quotation and resolve buyer questions", businessDays:3},
  };
  const rule = defaults[outcome];
  return rule ? {nextAction:rule.nextAction,nextActionDue:addBusinessDays(today,rule.businessDays)} : null;
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
  const positive = (outcomeCounts.interested || 0) + (outcomeCounts.meeting_booked || 0) + (outcomeCounts.quote_requested || 0) + (outcomeCounts.quote_sent || 0) + (outcomeCounts.won || 0);
  return {totalLeads: rows.length, leadCounts, outcomeCounts, overdue, dueToday, contacted, positive, positiveRate: contacted ? Math.round(positive / contacted * 100) : 0};
}
