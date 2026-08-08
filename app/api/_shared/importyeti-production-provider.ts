/**
 * ImportYeti Production Provider — Sprint 14.4
 *
 * Calls the real ImportYeti paid API. Requires environment variables:
 *   IMPORTYETI_API_URL — base URL of the ImportYeti API
 *   IMPORTYETI_API_KEY — authentication key
 *
 * All API calls go through the approval gateway (preflight → approve → execute).
 * Credit guards and budget_blocked checks happen before this provider runs.
 */

import type { PaidOperation, UsageEvent } from "../_shared/importyeti-paid-gateway.ts";
import type { QueryParameters } from "../_shared/importyeti-credit-policy.ts";

/** Runtime environment — injected by Cloudflare Workers. */
export interface ImportYetiEnv {
  IMPORTYETI_API_KEY?: string;
  IMPORTYETI_API_URL?: string;
}

const TIMEOUT_MS = 30_000;

// ─────── Error types ───────

export class ImportYetiProviderError extends Error {
  constructor(
    message: string,
    public readonly code: "missing_key" | "missing_url" | "timeout" | "invalid_response" | "api_error" | "rate_limited",
    public readonly status?: number,
  ) {
    super(message);
    this.name = "ImportYetiProviderError";
  }
}

// ─────── API call ───────

export interface ImportYetiSearchParams {
  query: string;
  /** HS code prefix filter (e.g. "8481.80") */
  hsCode?: string;
  /** "importer" | "supplier" */
  entityType?: string;
  /** Max results (1-50) */
  limit?: number;
}

export interface ImportYetiSearchResult {
  companies: Array<{
    id: string;
    name: string;
    address?: string;
    country?: string;
    countryCode?: string;
    website?: string;
    totalShipments?: number;
    latestShipmentDate?: string;
    supplierCount?: number;
    productDescriptions?: string[];
  }>;
  totalResults: number;
  page: number;
}

async function fetchWithTimeout(url: string, options: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

export async function executeImportYetiSearch(
  env: ImportYetiEnv,
  params: ImportYetiSearchParams,
): Promise<{ raw: ImportYetiSearchResult; actualCost: number }> {
  const apiKey = env.IMPORTYETI_API_KEY;
  const apiUrl = env.IMPORTYETI_API_URL;

  if (!apiKey || apiKey === "YOUR_IMPORTYETI_API_KEY") {
    throw new ImportYetiProviderError(
      "IMPORTYETI_API_KEY is not configured. Add it to Cloudflare Workers secrets.",
      "missing_key",
    );
  }

  if (!apiUrl || apiUrl === "YOUR_IMPORTYETI_API_URL") {
    throw new ImportYetiProviderError(
      "IMPORTYETI_API_URL is not configured. Add it to Cloudflare Workers secrets.",
      "missing_url",
    );
  }

  const searchUrl = new URL(`${apiUrl}/search`);
  searchUrl.searchParams.set("q", params.query);
  searchUrl.searchParams.set("entity_type", params.entityType || "importer");
  if (params.hsCode) searchUrl.searchParams.set("hs_code", params.hsCode);
  searchUrl.searchParams.set("limit", String(Math.min(params.limit || 50, 50)));

  let response: Response;
  try {
    response = await fetchWithTimeout(
      searchUrl.toString(),
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          Accept: "application/json",
        },
      },
      TIMEOUT_MS,
    );
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new ImportYetiProviderError(
        `ImportYeti API request timed out after ${TIMEOUT_MS / 1000}s`,
        "timeout",
      );
    }
    throw new ImportYetiProviderError(
      `ImportYeti API request failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      "api_error",
    );
  }

  if (response.status === 429) {
    throw new ImportYetiProviderError(
      "ImportYeti API rate limited (429). Wait before retrying.",
      "rate_limited",
      429,
    );
  }

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new ImportYetiProviderError(
      `ImportYeti API returned ${response.status}${body ? `: ${body.slice(0, 200)}` : ""}`,
      "api_error",
      response.status,
    );
  }

  let data: unknown;
  try {
    data = await response.json();
  } catch {
    throw new ImportYetiProviderError(
      "ImportYeti API returned invalid JSON",
      "invalid_response",
      response.status,
    );
  }

  const result = data as { companies?: unknown[]; total?: number; page?: number };
  if (!result || !Array.isArray(result.companies)) {
    throw new ImportYetiProviderError(
      "ImportYeti API response missing companies array",
      "invalid_response",
    );
  }

  const normalized: ImportYetiSearchResult = {
    companies: result.companies.map((c: Record<string, unknown>, i: number) => ({
      id: String(c.id || c.company_id || `importyeti_${params.query}_${i}`),
      name: String(c.name || ""),
      address: typeof c.address === "string" ? c.address : undefined,
      country: typeof c.country === "string" ? c.country : undefined,
      countryCode: typeof c.country_code === "string" ? c.country_code : typeof c.countryCode === "string" ? c.countryCode : undefined,
      website: typeof c.website === "string" ? c.website : undefined,
      totalShipments: typeof c.total_shipments === "number" ? c.total_shipments : typeof c.shipment_count === "number" ? c.shipment_count : undefined,
      latestShipmentDate: typeof c.latest_shipment_date === "string" ? c.latest_shipment_date : undefined,
      supplierCount: typeof c.supplier_count === "number" ? c.supplier_count : undefined,
      productDescriptions: Array.isArray(c.product_descriptions) ? c.product_descriptions as string[] : undefined,
    })),
    totalResults: typeof result.total === "number" ? result.total : (result.companies || []).length,
    page: typeof result.page === "number" ? result.page : 1,
  };

  // Cost estimation: base 2 credits + 1 per 10 companies
  const actualCost = 2 + Math.ceil((normalized.companies.length || 0) / 10);
  return { raw: normalized, actualCost };
}

// ─────── Error → gateway event log ───────

export function providerErrorToEvent(error: unknown): { message: string; eventType: string } {
  if (error instanceof ImportYetiProviderError) {
    return { message: error.message, eventType: `provider_${error.code}` };
  }
  return {
    message: error instanceof Error ? error.message : "Unknown provider error",
    eventType: "provider_error",
  };
}

// ─────── Operation factories ───────

export function createCompanySearchOperation(env: ImportYetiEnv): PaidOperation {
  return {
    id: "importyeti_company_search",
    description: (p: QueryParameters) =>
      `Search ImportYeti for "${p.query}" (${p.entity_type || "importer"}, ${p.hs_code || "all HS codes"})`,
    estimate: (p: QueryParameters) => {
      // Conservative: 3 credits per search
      const limit = Number(p.limit) || 50;
      return 2 + Math.ceil(Math.min(limit, 50) / 25);
    },
    maximumCost: (p: QueryParameters) => {
      // Safety cap: never charge more than 5 credits per search
      return 5;
    },
    execute: async (p: QueryParameters) => {
      return executeImportYetiSearch(env, {
        query: String(p.query || ""),
        hsCode: typeof p.hs_code === "string" ? p.hs_code : undefined,
        entityType: typeof p.entity_type === "string" ? p.entity_type : "importer",
        limit: Number(p.limit) || 50,
      });
    },
    ttlMs: 24 * 60 * 60 * 1000, // 24 hour cache
  };
}
