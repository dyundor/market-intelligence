import { normalizeCompanyName } from "../entities/company.ts";

export type ContactResearchStatus = "verified" | "needs_identity_match" | "unresolved" | "disqualified";
export type ContactResearchReason = "official_contact_found" | "no_official_site" | "ambiguous_company_name" | "identity_not_confirmed" | "competitor_or_supplier";

export interface ContactResearchEvidence {
  companyName: string;
  status: ContactResearchStatus;
  reasonCode: ContactResearchReason;
  reason: string;
  nextAction: string;
  evidenceUrls: string[];
}

export function validateContactResearch(item: ContactResearchEvidence): string[] {
  const errors: string[] = [];
  if (!item.companyName.trim()) errors.push("companyName required");
  if (!item.reason.trim()) errors.push("reason required");
  if (!item.nextAction.trim()) errors.push("nextAction required");
  if (item.status === "verified" && item.reasonCode !== "official_contact_found") errors.push("verified status requires official_contact_found");
  if (item.status === "disqualified" && item.reasonCode !== "competitor_or_supplier") errors.push("disqualified status requires competitor_or_supplier");
  if (item.status !== "verified" && item.reasonCode === "official_contact_found") errors.push("official_contact_found requires verified status");
  if (item.status !== "disqualified" && item.reasonCode === "competitor_or_supplier") errors.push("competitor_or_supplier requires disqualified status");
  for (const url of item.evidenceUrls) if (!url.startsWith("https://")) errors.push(`${url}: evidence URL must use https`);
  return errors;
}

export function contactResearchId(companyName: string): string {
  return `lcr-${normalizeCompanyName(companyName).replaceAll(" ", "-")}`;
}

export function summarizeContactResearch(items: Array<{status: ContactResearchStatus}>) {
  const verified = items.filter(item => item.status === "verified").length;
  const needsIdentityMatch = items.filter(item => item.status === "needs_identity_match").length;
  const unresolved = items.filter(item => item.status === "unresolved").length;
  const disqualified = items.filter(item => item.status === "disqualified").length;
  return {total:items.length, verified, needsIdentityMatch, unresolved, disqualified, coveragePercent:items.length ? Math.round((verified + disqualified) / items.length * 100) : 0};
}
