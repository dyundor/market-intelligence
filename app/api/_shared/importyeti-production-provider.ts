/**
 * ImportYeti Production Provider — Sprint 14.10
 *
 * Official ImportYeti API integration:
 *   Base URL:  https://data.importyeti.com
 *   Endpoints: /v1.0/company/search
 *              /v1.0/product/{product}/companies
 *              /v1.0/company/{company}/bols
 *
 * Authentication:
 *   Header: Authorization: Bearer <API_KEY>
 *
 * Environment (set via Cloudflare Workers secrets, NEVER in code):
 *   IMPORTYETI_API_KEY — daff3e... (hex key)
 *   IMPORTYETI_API_URL — defaults to https://data.importyeti.com
 *
 * Usage:
 *   wrangler secret put IMPORTYETI_API_KEY
 *   wrangler secret put IMPORTYETI_API_URL  (optional, has default)
 */

import type { PaidOperation } from "../_shared/importyeti-paid-gateway.ts";
import type { QueryParameters } from "../_shared/importyeti-credit-policy.ts";

// ─────── Official API constants ───────

const OFFICIAL_BASE_URL = "https://data.importyeti.com";
const API_VERSION = "v1.0";
const TIMEOUT_MS = 30_000;

/** Runtime environment — injected by Cloudflare Workers. */
export interface ImportYetiEnv {
  IMPORTYETI_API_KEY?: string;
  IMPORTYETI_API_URL?: string;
}

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

// ─────── Types ───────

export interface ImportYetiSearchParams {
  query: string;
  hsCode?: string;
  /** "importer" | "supplier" */
  entityType?: string;
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
    matchingShipments?: number;
    latestShipmentDate?: string;
    supplierCount?: number;
    supplierNames?: string[];
    productDescriptions?: string[];
    weightKg?: number;
    relevanceScore?: number;
    specialization?: number;
  }>;
  totalResults: number;
  page: number;
  /** Real ImportYeti credit cost for this request */
  requestCost?: number;
  /** Real ImportYeti account credits remaining */
  creditsRemaining?: number;
}

// ─────── HTTP helpers ───────

async function fetchWithTimeout(url: string, options: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

// ─────── API call — company search ───────

/**
 * GET /v1.0/company/search
 *
 * Search ImportYeti for companies by name or product keyword.
 * Returns up to 50 companies per page.
 */
export async function executeCompanySearch(
  env: ImportYetiEnv,
  params: ImportYetiSearchParams,
): Promise<{ raw: ImportYetiSearchResult; actualCost: number }> {
  const apiKey = env.IMPORTYETI_API_KEY;
  const baseUrl = env.IMPORTYETI_API_URL || OFFICIAL_BASE_URL;

  validateCredentials(apiKey, baseUrl);

  const url = new URL(`${baseUrl}/${API_VERSION}/company/search`);
  url.searchParams.set("q", params.query);
  url.searchParams.set("limit", String(Math.min(params.limit || 50, 50)));

  const response = await apiCall(url, apiKey, params.query);

  const data = await parseResponse(response);
  const result = normalizeSearchResult(data, params.query);

  const actualCost = 2 + Math.ceil((result.companies.length || 0) / 10);
  return { raw: result, actualCost };
}

/**
 * GET /v1.0/product/{product}/companies
 *
 * Search for companies importing a specific product.
 * More targeted than company search — better for bathroom product discovery.
 */
export async function executeProductCompanySearch(
  env: ImportYetiEnv,
  product: string,
  limit = 50,
): Promise<{ raw: ImportYetiSearchResult; actualCost: number }> {
  const apiKey = env.IMPORTYETI_API_KEY;
  const baseUrl = env.IMPORTYETI_API_URL || OFFICIAL_BASE_URL;

  validateCredentials(apiKey, baseUrl);

  const encoded = encodeURIComponent(product);
  const url = new URL(`${baseUrl}/${API_VERSION}/product/${encoded}/companies`);
  url.searchParams.set("limit", String(Math.min(limit, 50)));

  const response = await apiCall(url, apiKey, product);

  const data = await parseResponse(response);
  const result = normalizeSearchResult(data, product);

  const actualCost = 2 + Math.ceil((result.companies.length || 0) / 10);
  return { raw: result, actualCost };
}

// ─────── Core API call ───────

function validateCredentials(apiKey: string | undefined, baseUrl: string): asserts apiKey is string {
  if (!apiKey || apiKey.length < 10) {
    throw new ImportYetiProviderError(
      "IMPORTYETI_API_KEY is not configured. Run: wrangler secret put IMPORTYETI_API_KEY",
      "missing_key",
    );
  }
  if (!baseUrl) {
    throw new ImportYetiProviderError(
      "IMPORTYETI_API_URL is not configured. Default: https://data.importyeti.com",
      "missing_url",
    );
  }
}

async function apiCall(url: URL, apiKey: string, queryDescription: string): Promise<Response> {
  let response: Response;
  try {
    response = await fetchWithTimeout(
      url.toString(),
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          Accept: "application/json",
          "User-Agent": "TradeScope-MarketIntelligence/1.0",
        },
      },
      TIMEOUT_MS,
    );
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new ImportYetiProviderError(
        `ImportYeti API timed out after ${TIMEOUT_MS / 1000}s for "${queryDescription}"`,
        "timeout",
      );
    }
    throw new ImportYetiProviderError(
      `ImportYeti API call failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      "api_error",
    );
  }

  if (response.status === 401 || response.status === 403) {
    throw new ImportYetiProviderError(
      `ImportYeti API authentication failed (${response.status}). Verify your API key.`,
      "api_error",
      response.status,
    );
  }

  if (response.status === 429) {
    throw new ImportYetiProviderError(
      "ImportYeti API rate limited (429). Retry after the Retry-After header.",
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

  return response;
}

async function parseResponse(response: Response): Promise<Record<string, unknown>> {
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
  return data as Record<string, unknown>;
}

function normalizeSearchResult(
  data: Record<string, unknown>,
  query: string,
): ImportYetiSearchResult {
  const companies = (
    (Array.isArray(data.data) ? data.data : null) ||
    (Array.isArray(data.companies) ? data.companies : null) ||
    (Array.isArray(data.results) ? data.results : null) ||
    []
  ) as Record<string, unknown>[];

  return {
    companies: companies.map((c, i) => ({
      // ImportYeti API uses company_name, company_link, etc.
      id: String(c.company_link || c.id || `iy_${query}_${i}`),
      name: String(c.company_name || c.name || ""),
      address: typeof c.address === "string" ? c.address : undefined,
      country: typeof c.country === "string" ? c.country : undefined,
      countryCode: typeof c.country_code === "string" ? c.country_code : undefined,
      website: typeof c.website === "string" ? c.website : undefined,
      totalShipments: typeof c.company_total_shipments === "number" ? c.company_total_shipments
        : typeof c.total_shipments === "number" ? c.total_shipments
        : undefined,
      matchingShipments: typeof c.matching_shipments === "number" ? c.matching_shipments : undefined,
      supplierCount: typeof c.total_suppliers === "number" ? c.total_suppliers
        : typeof c.supplier_count === "number" ? c.supplier_count
        : undefined,
      supplierNames: Array.isArray(c.company_suppliers) ? c.company_suppliers as string[]
        : Array.isArray(c.suppliers) ? c.suppliers as string[]
        : undefined,
      productDescriptions: Array.isArray(c.product_description) ? c.product_description as string[]
        : Array.isArray(c.product_descriptions) ? c.product_descriptions as string[]
        : typeof c.products === "string" ? c.products.split(/[,;]/).map(s => s.trim())
        : undefined,
      weightKg: typeof c.weight === "number" ? c.weight : undefined,
      relevanceScore: typeof c.relevance_score === "number" ? c.relevance_score : undefined,
      specialization: typeof c.specialization === "number" ? c.specialization : undefined,
    })),
    totalResults: typeof data.total_results === "number" ? data.total_results
      : typeof data.total === "number" ? data.total
      : companies.length,
    page: typeof data.page === "number" ? data.page : 1,
    requestCost: typeof data.requestCost === "number" ? data.requestCost : undefined,
    creditsRemaining: typeof data.creditsRemaining === "number" ? data.creditsRemaining : undefined,
  };
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
      `Search ImportYeti for "${p.query}" via /v1.0/company/search`,
    estimate: (p: QueryParameters) => {
      const limit = Number(p.limit) || 50;
      return 2 + Math.ceil(Math.min(limit, 50) / 25);
    },
    maximumCost: () => 5,
    execute: async (p: QueryParameters) => {
      return executeCompanySearch(env, {
        query: String(p.query || ""),
        limit: Number(p.limit) || 50,
      });
    },
    ttlMs: 24 * 60 * 60 * 1000,
  };
}

export function createProductSearchOperation(env: ImportYetiEnv): PaidOperation {
  return {
    id: "importyeti_product_search",
    description: (p: QueryParameters) =>
      `Search ImportYeti for product "${p.query}" via /v1.0/product/{product}/companies`,
    estimate: (p: QueryParameters) => {
      const limit = Number(p.limit) || 50;
      return 2 + Math.ceil(Math.min(limit, 50) / 25);
    },
    maximumCost: () => 5,
    execute: async (p: QueryParameters) => {
      return executeProductCompanySearch(env, String(p.query || ""), Number(p.limit) || 50);
    },
    ttlMs: 24 * 60 * 60 * 1000,
  };
}

// ─────── Legacy alias — used by capture mode ───────

export { executeCompanySearch as executeImportYetiSearch };
