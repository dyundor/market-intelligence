export interface HsRelationship {
  hs_codes?: string | null;
}

export interface HsEvidence {
  totalRelationships: number;
  codedRelationships: number;
  matchedRelationships: number;
  missingRelationships: number;
  matchPercent: number | null;
}

export function normalizeHsCode(value: string): string {
  return value.replace(/\D/g, "");
}

export function parseHsCodes(value: string | null | undefined): string[] {
  if (!value?.trim()) return [];
  return [...new Set(value
    .split(/[,;|/\s]+/)
    .map(normalizeHsCode)
    .filter(code => code.length >= 4))];
}

function sameHsFamily(code: string, target: string): boolean {
  return code === target || code.startsWith(target) || target.startsWith(code);
}

export function calculateHsEvidence(relationships: HsRelationship[], targetHsCode: string): HsEvidence {
  const target = normalizeHsCode(targetHsCode);
  const coded = relationships.map(relationship => parseHsCodes(relationship.hs_codes)).filter(codes => codes.length > 0);
  const matchedRelationships = target
    ? coded.filter(codes => codes.some(code => sameHsFamily(code, target))).length
    : 0;
  return {
    totalRelationships: relationships.length,
    codedRelationships: coded.length,
    matchedRelationships,
    missingRelationships: relationships.length - coded.length,
    matchPercent: coded.length ? Math.round(matchedRelationships / coded.length * 100) : null,
  };
}
