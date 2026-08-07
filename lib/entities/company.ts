export type CompanyRole = "importer" | "supplier" | "unknown";

export interface Company {
  id: string;
  name: string;
  identityKey: string;
  aliases: string[];
  entityType: CompanyRole;
  country: string | null;
  countryCode: string | null;
  website: string | null;
  sourceChannel: string;
  sourceUrl: string | null;
}

const LEGAL_SUFFIXES = new Set([
  "co",
  "corp",
  "corporation",
  "inc",
  "incorporated",
  "llc",
  "l.l.c",
  "ltd",
  "limited",
  "gmbh",
  "group",
  "holding",
  "holdings",
  "company",
  "co.",
  "corp.",
  "inc.",
  "llc.",
  "ltd.",
  "sa",
  "s.a",
]);

export function normalizeCompanyName(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(word => word && !LEGAL_SUFFIXES.has(word))
    .join(" ");
}

export function companyIdentityKey(name: string): string {
  return normalizeCompanyName(name) || name.trim().toLowerCase();
}

export function companyFromRow(row: Record<string, unknown>): Company {
  const name = String(row.name || row.id || "");
  return {
    id: String(row.id || ""),
    name,
    identityKey: companyIdentityKey(name),
    aliases: Array.isArray(row.aliases) ? row.aliases.map(String) : [],
    entityType: "importer",
    country: row.country ? String(row.country) : null,
    countryCode: row.country_code ? String(row.country_code) : null,
    website: row.website ? String(row.website) : null,
    sourceChannel: String(row.source_channel || "unknown"),
    sourceUrl: row.source_url ? String(row.source_url) : null,
  };
}
