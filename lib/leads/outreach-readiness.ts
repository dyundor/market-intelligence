export type OutreachBlocker = "identity_unverified" | "verified_contact_missing" | "contact_research_unresolved";

export interface OutreachReadinessInput {
  identityVerified: boolean;
  verifiedContactCount: number;
  contactResearchStatus: string | null;
}

export function evaluateOutreachReadiness(input: OutreachReadinessInput) {
  const blockers: OutreachBlocker[] = [];
  if (!input.identityVerified) blockers.push("identity_unverified");
  if (input.verifiedContactCount < 1) blockers.push("verified_contact_missing");
  if (input.contactResearchStatus && input.contactResearchStatus !== "verified") blockers.push("contact_research_unresolved");
  return {ready:blockers.length===0,blockers};
}
