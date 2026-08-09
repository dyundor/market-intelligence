import type { ContactRouteQuality } from "./contact-quality.ts";

export interface ContactGapInput {
  companyId: string;
  companyName: string;
  leadStatus: string;
  commercialFitScore: number | null;
  outreachScore: number | null;
  bestContactRouteQuality: ContactRouteQuality | null;
  bestContactLabel?: string | null;
  researchNextAction?: string | null;
  nextActionDue?: string | null;
}

export interface ContactGapTask extends ContactGapInput {
  priorityScore: number;
  recommendedAction: string;
}

export function buildContactGapQueue(rows: ContactGapInput[]): ContactGapTask[] {
  return rows.flatMap(row => {
    if (row.leadStatus !== "contact_ready" || row.bestContactRouteQuality === "decision_maker") return [];
    const commercial = Math.max(0,Math.min(100,row.commercialFitScore ?? 0));
    const outreach = Math.max(0,Math.min(100,row.outreachScore ?? 0));
    const gapBonus = row.bestContactRouteQuality === "fallback" || row.bestContactRouteQuality === null ? 10 : row.bestContactRouteQuality === "general_route" ? 7 : 4;
    const priorityScore = Math.round(commercial * 0.6 + outreach * 0.3 + gapBonus);
    const recommendedAction = row.researchNextAction?.trim() || (row.bestContactRouteQuality === "business_route"
      ? `Use ${row.bestContactLabel || "the verified business route"} to request the sourcing or product-development owner.`
      : row.bestContactRouteQuality === "general_route"
        ? `Ask ${row.bestContactLabel || "the verified company route"} for an internal introduction to purchasing.`
        : `Call the verified company route to identify the purchasing or product-development owner.`);
    return [{...row,priorityScore,recommendedAction}];
  }).sort((a,b)=>b.priorityScore-a.priorityScore || (a.nextActionDue || "9999").localeCompare(b.nextActionDue || "9999") || a.companyName.localeCompare(b.companyName));
}
