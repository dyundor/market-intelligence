export type OutreachBlocker = "identity_unverified" | "verified_contact_missing" | "contact_research_unresolved" | "lead_disqualified";

export interface OutreachReadinessInput {
  identityVerified: boolean;
  verifiedContactCount: number;
  contactResearchStatus: string | null;
  leadStatus?: string | null;
}

export function evaluateOutreachReadiness(input: OutreachReadinessInput) {
  if (input.leadStatus === "disqualified" || input.contactResearchStatus === "disqualified") {
    return {ready:false,blockers:["lead_disqualified"] as OutreachBlocker[]};
  }
  const blockers: OutreachBlocker[] = [];
  if (!input.identityVerified) blockers.push("identity_unverified");
  if (input.verifiedContactCount < 1) blockers.push("verified_contact_missing");
  if (input.contactResearchStatus && input.contactResearchStatus !== "verified") blockers.push("contact_research_unresolved");
  return {ready:blockers.length===0,blockers};
}
