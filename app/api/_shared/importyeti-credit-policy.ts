export const IMPORTYETI_PROVIDER = "importyeti_paid";
export const IMPORTYETI_TOTAL_CREDITS = 100;
export const IMPORTYETI_RESERVE_CREDITS = 25;

export type PaidGatewayStatus =
  | "cache_hit"
  | "free_source"
  | "credit_required"
  | "awaiting_approval"
  | "approved"
  | "executing"
  | "reapproval_required"
  | "budget_blocked"
  | "execution_disabled"
  | "completed"
  | "failed";

export type JsonPrimitive = string | number | boolean | null;
export type QueryParameters = Record<string,JsonPrimitive | JsonPrimitive[]>;

export function normalizePaidQuery(operation:string,parameters:QueryParameters) {
  const normalizedParameters = Object.fromEntries(
    Object.entries(parameters)
      .map(([key,value]) => [key.trim().toLowerCase(),normalizeValue(value)] as const)
      .sort(([left],[right]) => left.localeCompare(right)),
  );
  const requestedLimit = Number(normalizedParameters.limit || 0);
  const responseLimit = requestedLimit === 20 ? 20 : undefined;
  if (requestedLimit === 20) normalizedParameters.limit = 50;
  return {
    operation:operation.trim().toLowerCase(),
    parameters:normalizedParameters,
    responseLimit,
  };
}

function normalizeValue(value:JsonPrimitive | JsonPrimitive[]):JsonPrimitive | JsonPrimitive[] {
  if (Array.isArray(value)) return value.map(normalizeScalar).sort((a,b) => String(a).localeCompare(String(b)));
  return normalizeScalar(value);
}

function normalizeScalar(value:JsonPrimitive):JsonPrimitive {
  return typeof value === "string" ? value.trim().toLowerCase() : value;
}

export async function paidQueryHash(operation:string,parameters:QueryParameters) {
  const normalized = normalizePaidQuery(operation,parameters);
  const input = JSON.stringify({operation:normalized.operation,parameters:normalized.parameters});
  const bytes = await crypto.subtle.digest("SHA-256",new TextEncoder().encode(input));
  return [...new Uint8Array(bytes)].map(value => value.toString(16).padStart(2,"0")).join("");
}

export function budgetSnapshot(actualSpent:number,approvedReservations:number) {
  const remainingBeforeReserve = roundCredits(IMPORTYETI_TOTAL_CREDITS - actualSpent - approvedReservations);
  const available = roundCredits(Math.max(0,remainingBeforeReserve - IMPORTYETI_RESERVE_CREDITS));
  return {total:IMPORTYETI_TOTAL_CREDITS,reserve:IMPORTYETI_RESERVE_CREDITS,remainingBeforeReserve,available};
}

export function costPercentages(estimatedCost:number,remainingBefore:number) {
  return {
    percentOfTotal:roundPercent(estimatedCost / IMPORTYETI_TOTAL_CREDITS * 100),
    percentOfRemaining:remainingBefore > 0 ? roundPercent(estimatedCost / remainingBefore * 100) : null,
  };
}

export function roundCredits(value:number) {
  return Math.round((value + Number.EPSILON) * 1_000_000) / 1_000_000;
}

function roundPercent(value:number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function constantTimeSecretMatch(provided:string|undefined,expected:string|undefined) {
  if (!provided || !expected) return false;
  const encoder = new TextEncoder();
  const left = encoder.encode(provided);
  const right = encoder.encode(expected);
  const length = Math.max(left.length,right.length);
  let difference = left.length ^ right.length;
  for (let index=0;index<length;index+=1) difference |= (left[index] || 0) ^ (right[index] || 0);
  return difference === 0;
}

export function limitPaidResponse<T>(value:T,responseLimit?:number):T {
  if (!responseLimit) return value;
  if (Array.isArray(value)) return value.slice(0,responseLimit) as T;
  if (value && typeof value === "object") {
    const record = value as Record<string,unknown>;
    for (const key of ["results","data","items","shipments","companies"]) {
      if (Array.isArray(record[key])) return {...record,[key]:(record[key] as unknown[]).slice(0,responseLimit)} as T;
    }
  }
  return value;
}
