/**
 * ImportYeti Capture-Only Mode — Sprint 14.5
 *
 * Safe first-run capture: calls the API, validates the response,
 * generates a report, but does NOT update ranking or entity tables.
 *
 * After validation passes, regular execute() enables full pipeline.
 */

import type { ImportYetiSearchParams, ImportYetiSearchResult } from "./importyeti-production-provider.ts";
import { executeImportYetiSearch } from "./importyeti-production-provider.ts";
import type { ImportYetiEnv } from "./importyeti-production-provider.ts";

// ─────── Validation types ───────

export interface FieldPresence {
  field: string;
  present: boolean;
  sampleValue: string;
}

export interface CaptureReport {
  status: "ok" | "warnings" | "blocked";
  query: string;
  capturedAt: string;
  costEstimate: number;
  records: {
    totalCompanies: number;
    withShipmentData: number;
    withoutShipmentData: number;
    withWebsite: number;
    withAddress: number;
    withCountry: number;
    uniqueNames: number;
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

// ─────── Validation logic ───────

const EXPECTED_FIELDS = [
  "id", "name", "address", "country", "countryCode",
  "website", "totalShipments", "latestShipmentDate",
  "supplierCount", "productDescriptions",
] as const;

function sampleValue(value: unknown): string {
  if (value === undefined || value === null) return "(missing)";
  if (Array.isArray(value)) return `[${value.length} items] ${value.slice(0, 2).map(String).join(", ")}`;
  if (typeof value === "object") return JSON.stringify(value).slice(0, 80);
  return String(value).slice(0, 80);
}

export function validateImportYetiResponse(
  result: ImportYetiSearchResult,
  query: string,
  costEstimate: number,
): CaptureReport {
  const companies = result.companies;
  const warnings: string[] = [];
  const errors: string[] = [];

  // Field presence check
  const fieldPresence: FieldPresence[] = [];
  const first = companies[0] || {};

  for (const field of EXPECTED_FIELDS) {
    const keys = Object.keys(first);
    const direct = field in first;
    const camelVariant = field.replace(/([A-Z])/g, "_$1").toLowerCase() in first;
    const snakeVariant = field.replace(/_/g, "") in first;
    const present = direct || camelVariant || snakeVariant;
    fieldPresence.push({
      field,
      present,
      sampleValue: present ? sampleValue(first[field as keyof typeof first]) : "(missing)",
    });
  }

  const missingFields = fieldPresence.filter(f => !f.present);
  if (missingFields.length > 0) {
    warnings.push(`${missingFields.length} expected fields missing: ${missingFields.map(f => f.field).join(", ")}`);
  }

  if (missingFields.length >= 4) {
    errors.push("Too many missing fields — API response format may have changed.");
  }

  // Record counts
  const withShipmentData = companies.filter(c => (c.totalShipments || 0) > 0).length;
  const withoutShipmentData = companies.length - withShipmentData;
  const withWebsite = companies.filter(c => c.website).length;
  const withAddress = companies.filter(c => c.address).length;
  const withCountry = companies.filter(c => c.country).length;
  const uniqueNames = new Set(companies.map(c => c.name.toLowerCase().trim())).size;

  // Warnings
  if (companies.length === 0) {
    errors.push("API returned 0 companies — query may have no results or API is misconfigured.");
  }
  if (companies.length < 5) {
    warnings.push(`Only ${companies.length} companies returned — query may be too narrow.`);
  }
  if (withShipmentData === 0 && companies.length > 0) {
    warnings.push("0 companies have shipment data — response may be incomplete.");
  }
  if (uniqueNames < companies.length) {
    warnings.push(`${companies.length - uniqueNames} duplicate names detected in response.`);
  }
  if (withWebsite === 0) {
    warnings.push("0 companies have website URLs — website enrichment may be needed.");
  }
  if (companies.length >= 45) {
    warnings.push(`${companies.length} companies returned — near 50-item limit, some results may be truncated.`);
  }

  // Sample companies (top 5 by shipments)
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

  // Determine status
  let status: CaptureReport["status"] = "ok";
  let readyForFullPipeline = true;

  if (errors.length > 0) {
    status = "blocked";
    readyForFullPipeline = false;
  } else if (warnings.length > 0) {
    status = "warnings";
    // Warnings don't block — but user should review
  }

  return {
    status,
    query,
    capturedAt: new Date().toISOString(),
    costEstimate,
    records: {
      totalCompanies: companies.length,
      withShipmentData,
      withoutShipmentData,
      withWebsite,
      withAddress,
      withCountry,
      uniqueNames,
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
  const costEstimate = 2 + Math.ceil(50 / 25); // Max 50 results → 4 credits
  const result = await executeImportYetiSearch(env, {
    query,
    hsCode,
    entityType: "importer",
    limit: 50,
  });
  const report = validateImportYetiResponse(result.raw, query, costEstimate);
  return { report, raw: result.raw, actualCost: result.actualCost };
}
