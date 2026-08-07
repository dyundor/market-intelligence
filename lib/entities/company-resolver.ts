import { companyIdentityKey } from "./company.ts";

export interface CompanyIdentityRecord {
  id: string;
  name: string;
  identityKey: string;
  aliases: string[];
}

export function recordFromCompany(company: { id: string; name: string; identityKey: string; aliases?: string[] }): CompanyIdentityRecord {
  return {
    id: company.id,
    name: company.name,
    identityKey: company.identityKey,
    aliases: company.aliases || [],
  };
}

export function aliasMatches(alias: string, input: string): boolean {
  return companyIdentityKey(alias) === companyIdentityKey(input);
}

export function resolveCompanyIdentity(records: CompanyIdentityRecord[], input: string): CompanyIdentityRecord | null {
  if (!input || !input.trim()) return null;
  const key = companyIdentityKey(input);
  for (const record of records) {
    if (record.identityKey === key) return record;
    for (const alias of record.aliases) {
      if (companyIdentityKey(alias) === key) return record;
    }
  }
  return null;
}

export function mergeCompany(records: CompanyIdentityRecord[], candidate: CompanyIdentityRecord): { record: CompanyIdentityRecord; matched: boolean } {
  const existing = resolveCompanyIdentity(records, candidate.name);
  if (existing) return { record: existing, matched: true };
  const duplicateByAlias = records.find(record => candidate.aliases.some(alias => aliasMatches(alias, record.name)));
  if (duplicateByAlias) return { record: duplicateByAlias, matched: true };
  return { record: candidate, matched: false };
}
