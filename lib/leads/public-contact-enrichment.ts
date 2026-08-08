import { normalizeCompanyName } from "../entities/company.ts";

export interface PublicContactEvidence {
  type: "email" | "phone" | "linkedin" | "website_contact_page";
  value: string;
  label: string;
  sourceUrl: string;
  verificationStatus: "unverified" | "verified";
}

export interface PublicCompanyEvidence {
  companyName: string;
  website: string;
  websiteSourceUrl: string;
  contacts: PublicContactEvidence[];
}

export interface CompanyMatchCandidate { id: string; name: string }

export function matchCompanyEvidence(evidence: PublicCompanyEvidence, candidates: CompanyMatchCandidate[]) {
  const target = normalizeCompanyName(evidence.companyName);
  const matches = candidates.filter(candidate => normalizeCompanyName(candidate.name) === target);
  return matches.length === 1
    ? { status: "matched" as const, company: matches[0] }
    : { status: matches.length ? "ambiguous" as const : "unmatched" as const, company: null };
}

export function validatePublicEvidence(evidence: PublicCompanyEvidence): string[] {
  const errors: string[] = [];
  if (!evidence.companyName.trim()) errors.push("companyName required");
  if (!evidence.website.startsWith("https://")) errors.push("website must use https");
  if (!evidence.websiteSourceUrl.startsWith("https://")) errors.push("websiteSourceUrl required");
  for (const contact of evidence.contacts) {
    if (!contact.value.trim()) errors.push(`${contact.type}: value required`);
    if (!contact.sourceUrl.startsWith("https://")) errors.push(`${contact.type}: sourceUrl required`);
    if (contact.type === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact.value)) errors.push(`${contact.value}: invalid email`);
  }
  return errors;
}
