/**
 * ImportYeti Capture-Only Mode — Sprint 14.6
 *
 * Safe first-run capture with refined validation rules.
 *
 * Field importance levels:
 *   Critical  — blocks full pipeline if missing (name, shipment records)
 *   Important — warning if missing (address, supplier info)
 *   Optional  — informational only (website, contact data)
 *
 * Record count rules:
 *   0 companies  → BLOCKED
 *   <5 companies → WARNING (valid narrow query)
 *   ≥45 companies → WARNING (near API limit, some results may be truncated)
 *   Any count    → OK (valid queries return various sizes)
 */

import type { ImportYetiSearchParams, ImportYetiSearchResult } from "./importyeti-production-provider.ts";
import { executeImportYetiSearch } from "./importyeti-production-provider.ts";
import type { ImportYetiEnv } from "./importyeti-production-provider.ts";

// ─────── Field importance ───────

type FieldImportance = "critical" | "important" | "optional";

interface FieldDef {
  field: string;
  importance: FieldImportance;
  description: string;
}

const FIELD_DEFS: FieldDef[] = [
  { field: "name",              importance: "critical",  description: "Company name" },
  { field: "totalShipments",    importance: "critical",  description: "Total shipment count" },
  { field: "id",                importance: "important", description: "Company identifier" },
  { field: "address",           importance: "important", description: "Physical address" },
  { field: "country",           importance: "important", description: "Country" },
  { field: "supplierCount",     importance: "important", description: "Supplier count" },
  { field: "latestShipmentDate",importance: "important", description: "Latest shipment date" },
  { field: "productDescriptions",importance: "important",description: "Product descriptions" },
  { field: "countryCode",       importance: "optional",  description: "Country code (ISO)" },
  { field: "website",           importance: "optional",  description: "Company website URL" },
];

// ─────── Credit report ───────

export interface CreditUsageReport {
  totalBudget: number;
  reserveBudget: number;
  creditsBefore: number;
  estimatedCost: number;
  actualCost: number;
  creditsAfter: number;
  remainingAvailable: number;
  reserveRemaining: number;
  percentOfTotalUsed: number;
}

// ─────── Validation types ───────

export interface FieldPresence {
  field: string;
  importance: FieldImportance;
  present: boolean;
  sampleValue: string;
}

export interface CaptureReport {
  status: "ok" | "warnings" | "blocked";
  query: string;
  capturedAt: string;
  creditReport: CreditUsageReport;
  records: {
    totalCompanies: number;
    withShipmentData: number;
    withoutShipmentData: number;
    withWebsite: number;
    withAddress: number;
    withCountry: number;
    uniqueNames: number;
  };
  fieldSummary: {
    criticalMissing: string[];
    importantMissing: string[];
    optionalMissing: string[];
  };
  fieldPresence: FieldPresence[];
  sampleCompanies: Array<Record<string, unknown>>;
  warnings: string[];
  errors: string[];
  readyForFullPipeline: boolean;
}

export interface CaptureResult {
  report: CaptureReport;
  raw: ImportYetiSearchResult;
  actualCost: number;
}

// ─────── Helpers ───────

const TOTAL_BUDGET = 100;
const RESERVE_BUDGET = 25;

function sampleValue(value: unknown): string {
  if (value === undefined || value === null) return "(missing)";
  if (Array.isArray(value)) return `[${value.length} items] ${value.slice(0, 2).map(String).join(", ")}`;
  if (typeof value === "object") return JSON.stringify(value).slice(0, 80);
  return String(value).slice(0, 80);
}

function buildCreditReport(estimatedCost: number, actualCost: number): CreditUsageReport {
  // In production these would come from UsageStore.costs().
  // For capture mode, we use the estimate as a preview.
  const creditsBefore = TOTAL_BUDGET;
  const creditsAfter = creditsBefore - actualCost;
  const remainingAvailable = Math.max(0, creditsAfter - RESERVE_BUDGET);
  return {
    totalBudget: TOTAL_BUDGET,
    reserveBudget: RESERVE_BUDGET,
    creditsBefore,
    estimatedCost,
    actualCost,
    creditsAfter,
    remainingAvailable,
    reserveRemaining: RESERVE_BUDGET,
    percentOfTotalUsed: Math.round(actualCost / TOTAL_BUDGET * 100),
  };
}

// ─────── Validation logic ───────

export function validateImportYetiResponse(
  result: ImportYetiSearchResult,
  query: string,
  estimatedCost: number,
  actualCost: number,
): CaptureReport {
  const companies = result.companies;
  const warnings: string[] = [];
  const errors: string[] = [];

  // ── Field presence with importance ──
  const fieldPresence: FieldPresence[] = [];
  const first = companies[0] || {};

  for (const def of FIELD_DEFS) {
    const direct = def.field in first;
    const camelVariant = def.field.replace(/([A-Z])/g, "_$1").toLowerCase() in first;
    const present = direct || camelVariant;
    fieldPresence.push({
      field: def.field,
      importance: def.importance,
      present,
      sampleValue: present ? sampleValue(first[def.field as keyof typeof first]) : "(missing)",
    });
  }

  const criticalMissing = fieldPresence.filter(f => !f.present && f.importance === "critical").map(f => f.field);
  const importantMissing = fieldPresence.filter(f => !f.present && f.importance === "important").map(f => f.field);
  const optionalMissing = fieldPresence.filter(f => !f.present && f.importance === "optional").map(f => f.field);

  // Only critical missing fields are errors
  if (criticalMissing.length > 0) {
    errors.push(`Critical fields missing: ${criticalMissing.join(", ")}`);
  }
  if (importantMissing.length > 0) {
    warnings.push(`${importantMissing.length} important fields missing: ${importantMissing.join(", ")}`);
  }
  if (optionalMissing.length > 0) {
    // Optional — informational only, not a warning
  }

  // ── Record counts ──
  const withShipmentData = companies.filter(c => (c.totalShipments || 0) > 0).length;
  const withoutShipmentData = companies.length - withShipmentData;
  const withWebsite = companies.filter(c => c.website).length;
  const withAddress = companies.filter(c => c.address).length;
  const withCountry = companies.filter(c => c.country).length;
  const uniqueNames = new Set(companies.map(c => (c.name || "").toLowerCase().trim())).size;

  // Record count rules (refined Sprint 14.6)
  if (companies.length === 0) {
    errors.push("API returned 0 companies — query may have no results or API is misconfigured.");
  }
  if (companies.length > 0 && companies.length < 5) {
    warnings.push(`Only ${companies.length} companies returned — this is a narrow query result, not an error.`);
  }
  if (companies.length >= 45) {
    warnings.push(`${companies.length} companies returned — near API 50-item limit; some results may be truncated. This is a WARNING, not a blocker.`);
  }
  if (withShipmentData === 0 && companies.length > 0) {
    warnings.push("0 companies have shipment data — API response may be incomplete or this is a niche product category.");
  }
  if (uniqueNames < companies.length) {
    warnings.push(`${companies.length - uniqueNames} duplicate names detected — identity system will merge these during full execution.`);
  }
  if (withWebsite === 0 && companies.length > 0) {
    warnings.push("0 companies have website URLs — website enrichment may be needed separately.");
  }

  // ── Sample companies ──
  const sample = [...companies]
    .sort((a, b) => (b.totalShipments || 0) - (a.totalShipments || 0))
    .slice(0, 5)
    .map(c => ({
      name: c.name,
      country: c.country || "(missing)",
      totalShipments: c.totalShipments || 0,
      latestShipmentDate: c.latestShipmentDate || "(missing)",
      supplierCount: c.supplierCount || 0,
      website: c.website ? "✓" : "✗",
      address: c.address ? "✓" : "✗",
    }));

  // ── Status determination ──
  let status: CaptureReport["status"] = "ok";
  let readyForFullPipeline = true;

  if (errors.length > 0) {
    status = "blocked";
    readyForFullPipeline = false;
  } else if (warnings.length > 0) {
    status = "warnings";
    // Warnings alone don't block — human review recommended
  }

  // ── Credit report ──
  const creditReport = buildCreditReport(estimatedCost, actualCost);

  return {
    status,
    query,
    capturedAt: new Date().toISOString(),
    creditReport,
    records: {
      totalCompanies: companies.length,
      withShipmentData,
      withoutShipmentData,
      withWebsite,
      withAddress,
      withCountry,
      uniqueNames,
    },
    fieldSummary: {
      criticalMissing,
      importantMissing,
      optionalMissing,
    },
    fieldPresence,
    sampleCompanies: sample as Array<Record<string, unknown>>,
    warnings,
    errors,
    readyForFullPipeline,
  };
}

// ─────── Capture-only execution ───────

export async function executeCaptureOnly(
  env: ImportYetiEnv,
  query: string,
  hsCode?: string,
): Promise<CaptureResult> {
  const estimatedCost = 2 + Math.ceil(50 / 25); // Max 50 results → 4 credits
  const result = await executeImportYetiSearch(env, {
    query,
    hsCode,
    entityType: "importer",
    limit: 50,
  });
  const report = validateImportYetiResponse(result.raw, query, estimatedCost, result.actualCost);
  return { report, raw: result.raw, actualCost: result.actualCost };
}
