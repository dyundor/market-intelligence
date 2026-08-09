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
  candidateName?: string;
}

export interface NoActiveWebsiteResearchRecord {
  companyId: string;
  companyName: string;
  outcome: "no_active_company_site";
  reviewSourceUrl: string;
  identitySignals: WebsiteIdentitySignal[];
  evidenceUrls: string[];
  rejectedCandidates: Array<{url:string;reason:string}>;
  relatedCompanies?: Array<{companyId:string;status:"confirmed"|"suspected";confidence:number;reason:string}>;
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

export function websiteEvidenceHost(value: string): string | null { return hostname(value); }

function nameTokens(value:string):string[]{return value.toLowerCase().replace(/[^a-z0-9]+/g," ").trim().split(/\s+/).map(token=>token.length>5?token.replace(/(inc|llc|ltd)$/,''):token).filter(token=>token&&!['co','company','corp','corporation','inc','llc','ltd','limited','and'].includes(token));}

export function scoreWebsiteCandidate(companyName:string,candidateName:string,signals:WebsiteIdentitySignal[]):number{
  const source=nameTokens(companyName),candidate=nameTokens(candidateName);
  const matched=source.filter(token=>candidate.some(other=>token===other||(token.length>=7&&other.startsWith(token))||(other.length>=7&&token.startsWith(other)))).length;
  const nameScore=source.length&&matched===source.length?45:source.length&&matched/source.length>=.75?25:0;
  const set=new Set(signals);
  return Math.min(100,nameScore+(set.has("address")?20:0)+(set.has("country")?10:0)+(set.has("product")?15:0)+(set.has("authoritative_cross_reference")?10:0)+(set.has("corporate_relationship")?15:0));
}

function isBlockedHost(value: string): boolean {
  const host = hostname(value);
  return !host || NON_OFFICIAL_HOSTS.some(blocked => host === blocked || host.endsWith(`.${blocked}`));
}

export function buildWebsiteSearchQueries(company: {name:string;address?:string|null;country?:string|null;products?:string|null}): string[] {
  const quotedName = `"${company.name.trim()}"`;
  const repairedName=company.name.trim().replace(/\bmanufacturin$/i,"Manufacturing");
  const addressAnchor = company.address?.split(",").map(part=>part.trim()).filter(Boolean).slice(-2).join(" ");
  return [...new Set([
    `${quotedName} official website`,
    repairedName!==company.name.trim()?`"${repairedName}" official website`:"",
    addressAnchor ? `${quotedName} "${addressAnchor}"` : "",
    company.country ? `${quotedName} ${company.country.trim()} contact` : "",
    company.products ? `${quotedName} ${company.products.trim()} manufacturer` : "",
  ].filter(Boolean))];
}

export function validateWebsiteResearch(record: WebsiteResearchRecord): string[] {
  const errors: string[] = [];
  if (!record.companyId?.trim() || !record.companyName?.trim()) errors.push("company identity is required");
  if (!record.website?.startsWith("https://") || isBlockedHost(record.website)) errors.push("website must be an independent HTTPS company domain");
  if (!record.websiteSourceUrl?.startsWith("https://")) errors.push("website source must use HTTPS");
  if (!Array.isArray(record.evidenceUrls) || record.evidenceUrls.length < 2 || record.evidenceUrls.some(url => !url.startsWith("https://"))) errors.push("at least two HTTPS evidence URLs are required");
  if (Array.isArray(record.evidenceUrls)) {
    const evidenceHosts=new Set(record.evidenceUrls.map(hostname).filter(Boolean));
    if(evidenceHosts.size<2)errors.push("evidence must include at least two independent domains");
    if(record.websiteSourceUrl&&!record.evidenceUrls.includes(record.websiteSourceUrl))errors.push("website source must be included in evidence URLs");
  }
  const signals = new Set(record.identitySignals || []);
  if (signals.size < 3) errors.push("at least three independent identity signals are required");
  if (!signals.has("exact_name") && !signals.has("corporate_relationship")) errors.push("exact name or a verified corporate relationship is required");
  if (record.websiteStatus === "verified_group_site" && (!signals.has("corporate_relationship") || !signals.has("authoritative_cross_reference"))) errors.push("group sites require corporate relationship and authoritative cross-reference evidence");
  if (record.websiteStatus === "verified_company_site" && !signals.has("exact_name")) errors.push("company sites require an exact-name match");
  if(record.candidateName&&scoreWebsiteCandidate(record.companyName,record.candidateName,record.identitySignals)<75)errors.push("candidate identity score is below the verified website threshold");
  for (const rejected of record.rejectedCandidates || []) {
    if (!rejected.url?.startsWith("https://") || !rejected.reason?.trim()) errors.push("rejected candidates require an HTTPS URL and reason");
  }
  return errors;
}

export function validateNoActiveWebsiteResearch(record: NoActiveWebsiteResearchRecord): string[] {
  const errors:string[]=[];
  if(!record.companyId?.trim()||!record.companyName?.trim())errors.push("company identity is required");
  if(record.outcome!=="no_active_company_site")errors.push("unsupported no-site outcome");
  if(!record.reviewSourceUrl?.startsWith("https://"))errors.push("review source must use HTTPS");
  const hosts=new Set((record.evidenceUrls||[]).map(hostname).filter(Boolean));
  if((record.evidenceUrls||[]).length<2||hosts.size<2)errors.push("no-site reviews require two independent evidence domains");
  if(!record.evidenceUrls?.includes(record.reviewSourceUrl))errors.push("review source must be included in evidence URLs");
  if(new Set(record.identitySignals||[]).size<3)errors.push("at least three independent identity signals are required");
  if(!record.rejectedCandidates?.length)errors.push("no-site reviews require at least one rejected candidate");
  for(const rejected of record.rejectedCandidates||[])if(!rejected.url?.startsWith("https://")||!rejected.reason?.trim())errors.push("rejected candidates require an HTTPS URL and reason");
  for(const related of record.relatedCompanies||[])if(!related.companyId?.trim()||!["confirmed","suspected"].includes(related.status)||related.confidence<1||related.confidence>100||!related.reason?.trim())errors.push("related companies require identity, status, confidence, and reason");
  return errors;
}
