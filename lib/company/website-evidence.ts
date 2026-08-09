export type WebsiteIdentitySignal = "exact_name" | "address" | "country" | "product" | "corporate_relationship" | "authoritative_cross_reference";
export type VerifiedWebsiteStatus = "verified_company_site" | "verified_group_site" | "verified_successor_site";

export interface WebsiteResearchRecord {
  companyId: string;
  companyName: string;
  website: string;
  websiteStatus: VerifiedWebsiteStatus;
  websiteSourceUrl: string;
  identitySignals: WebsiteIdentitySignal[];
  evidenceUrls: string[];
  rejectedCandidates?: Array<{url:string;reason:string}>;
}

const NON_OFFICIAL_HOSTS = [
  "alibaba.com", "bing.com", "facebook.com", "google.com", "importgenius.com",
  "importinfo.com", "importyeti.com", "linkedin.com", "made-in-china.com",
  "trademo.com", "volza.com",
];

function hostname(value: string): string | null {
  try { return new URL(value).hostname.toLowerCase().replace(/^www\./, ""); }
  catch { return null; }
}

function isBlockedHost(value: string): boolean {
  const host = hostname(value);
  return !host || NON_OFFICIAL_HOSTS.some(blocked => host === blocked || host.endsWith(`.${blocked}`));
}

export function buildWebsiteSearchQueries(company: {name:string;address?:string|null;country?:string|null;products?:string|null}): string[] {
  const quotedName = `"${company.name.trim()}"`;
  return [...new Set([
    `${quotedName} official website`,
    company.address ? `${quotedName} "${company.address.trim()}"` : "",
    company.country ? `${quotedName} ${company.country.trim()}` : "",
    company.products ? `${quotedName} ${company.products.trim()} manufacturer` : "",
  ].filter(Boolean))];
}

export function validateWebsiteResearch(record: WebsiteResearchRecord): string[] {
  const errors: string[] = [];
  if (!record.companyId?.trim() || !record.companyName?.trim()) errors.push("company identity is required");
  if (!record.website?.startsWith("https://") || isBlockedHost(record.website)) errors.push("website must be an independent HTTPS company domain");
  if (!record.websiteSourceUrl?.startsWith("https://")) errors.push("website source must use HTTPS");
  if (!Array.isArray(record.evidenceUrls) || record.evidenceUrls.length < 2 || record.evidenceUrls.some(url => !url.startsWith("https://"))) errors.push("at least two HTTPS evidence URLs are required");
  const signals = new Set(record.identitySignals || []);
  if (signals.size < 3) errors.push("at least three independent identity signals are required");
  if (!signals.has("exact_name") && !signals.has("corporate_relationship")) errors.push("exact name or a verified corporate relationship is required");
  if (record.websiteStatus === "verified_group_site" && (!signals.has("corporate_relationship") || !signals.has("authoritative_cross_reference"))) errors.push("group sites require corporate relationship and authoritative cross-reference evidence");
  if (record.websiteStatus === "verified_company_site" && !signals.has("exact_name")) errors.push("company sites require an exact-name match");
  for (const rejected of record.rejectedCandidates || []) {
    if (!rejected.url?.startsWith("https://") || !rejected.reason?.trim()) errors.push("rejected candidates require an HTTPS URL and reason");
  }
  return errors;
}
