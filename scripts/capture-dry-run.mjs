#!/usr/bin/env node
/**
 * Capture-mode dry-run — Sprint 14.5
 *
 * Runs the validation logic against simulated ImportYeti response data
 * to confirm the capture report generation works before any real API call.
 *
 * Usage:
 *   node scripts/capture-dry-run.mjs
 */

// Mirror the validation logic from importyeti-capture-mode.ts
const EXPECTED_FIELDS = ["id", "name", "address", "country", "countryCode", "website", "totalShipments", "latestShipmentDate", "supplierCount", "productDescriptions"];

function sampleValue(value) {
  if (value === undefined || value === null) return "(missing)";
  if (Array.isArray(value)) return `[${value.length} items] ${value.slice(0, 2).join(", ")}`;
  if (typeof value === "object") return JSON.stringify(value).slice(0, 80);
  return String(value).slice(0, 80);
}

function validate(companies, query) {
  const warnings = [];
  const errors = [];
  const first = companies[0] || {};

  // Field presence
  const fieldPresence = [];
  for (const field of EXPECTED_FIELDS) {
    const present = field in first;
    fieldPresence.push({ field, present, sampleValue: present ? sampleValue(first[field]) : "(missing)" });
  }

  const missing = fieldPresence.filter(f => !f.present);
  if (missing.length > 0) warnings.push(`${missing.length} expected fields missing: ${missing.map(f => f.field).join(", ")}`);
  if (missing.length >= 4) errors.push("Too many missing fields — API response format may have changed.");

  // Counts
  const withData = companies.filter(c => (c.totalShipments || 0) > 0).length;
  const withWeb = companies.filter(c => c.website).length;
  const withAddr = companies.filter(c => c.address).length;
  const withCountry = companies.filter(c => c.country).length;
  const unique = new Set(companies.map(c => (c.name || "").toLowerCase().trim())).size;

  if (companies.length === 0) errors.push("0 companies returned.");
  if (companies.length < 5) warnings.push(`Only ${companies.length} companies — query may be too narrow.`);
  if (withData === 0 && companies.length > 0) warnings.push("0 companies have shipment data.");
  if (unique < companies.length) warnings.push(`${companies.length - unique} duplicate names in response.`);
  if (companies.length >= 45) warnings.push(`${companies.length} companies — near 50-item limit.`);

  const sample = [...companies].sort((a, b) => (b.totalShipments || 0) - (a.totalShipments || 0)).slice(0, 5).map(c => ({
    name: c.name, country: c.country || "(missing)", totalShipments: c.totalShipments || 0,
    latestShipmentDate: c.latestShipmentDate || "(missing)", supplierCount: c.supplierCount || 0,
  }));

  let status = "ok", ready = true;
  if (errors.length > 0) { status = "blocked"; ready = false; }
  else if (warnings.length > 0) status = "warnings";

  return {
    status, query, capturedAt: new Date().toISOString(),
    records: { totalCompanies: companies.length, withShipmentData: withData, withoutShipmentData: companies.length - withData, withWebsite: withWeb, withAddress: withAddr, withCountry, uniqueNames: unique },
    fieldPresence, sampleCompanies: sample, warnings, errors, readyForFullPipeline: ready,
  };
}

// ─────── Test scenarios ───────

console.log("=".repeat(78));
console.log("CAPTURE-MODE DRY-RUN VALIDATION");
console.log("=".repeat(78));
console.log();

// Scenario 1: Good response (simulated real API output)
console.log("─".repeat(78));
console.log("SCENARIO 1: Normal API response (10 companies, all fields present)");
console.log("─".repeat(78));

const goodResponse = [];
for (let i = 0; i < 10; i++) {
  goodResponse.push({
    id: `company_${i}`, name: `Test Importer ${i}`,
    address: i < 8 ? `${100 + i} Main St, City, State` : undefined,
    country: "United States", countryCode: "US",
    website: i < 7 ? `https://test${i}.com` : undefined,
    totalShipments: [450, 320, 280, 190, 120, 85, 65, 45, 0, 0][i],
    latestShipmentDate: i < 8 ? `2026-0${8 - i}-01` : undefined,
    supplierCount: [5, 4, 3, 5, 2, 3, 4, 2, 0, 0][i],
    productDescriptions: i < 8 ? ["bathroom faucet", "lavatory basin mixer"] : [],
  });
}

const report1 = validate(goodResponse, "lavatory faucet");
console.log(JSON.stringify(report1, null, 2));

// Scenario 2: Partial response (missing fields)
console.log();
console.log("─".repeat(78));
console.log("SCENARIO 2: Sparse response (3 companies, missing fields)");
console.log("─".repeat(78));

const sparseResponse = [
  { id: "c1", name: "Sparse Co", country: "US" },
  { id: "c2", name: "Minimal Inc" },
  { id: "c3", name: "Bare Bones", country: "CA" },
];
const report2 = validate(sparseResponse, "narrow query");
console.log(JSON.stringify(report2, null, 2));

// Scenario 3: Empty response
console.log();
console.log("─".repeat(78));
console.log("SCENARIO 3: Empty response (0 companies)");
console.log("─".repeat(78));

const report3 = validate([], "nonexistent query");
console.log(JSON.stringify(report3, null, 2));

// Scenario 4: Duplicate names
console.log();
console.log("─".repeat(78));
console.log("SCENARIO 4: Duplicate names");
console.log("─".repeat(78));

const dupResponse = [
  { id: "c1", name: "ACME Corp", country: "US", totalShipments: 100, latestShipmentDate: "2026-07-01" },
  { id: "c2", name: "ACME Corp", country: "US", totalShipments: 50, latestShipmentDate: "2026-06-01" },
  { id: "c3", name: "acme corp", country: "US", totalShipments: 25, latestShipmentDate: "2026-05-01" },
  { id: "c4", name: "Unique Co", country: "US", totalShipments: 200, latestShipmentDate: "2026-07-15" },
];
const report4 = validate(dupResponse, "acme");
console.log(JSON.stringify(report4, null, 2));

// Scenario 5: Near-limit response
console.log();
console.log("─".repeat(78));
console.log("SCENARIO 5: Near-limit (47 companies)");
console.log("─".repeat(78));

const nearLimit = [];
for (let i = 0; i < 47; i++) {
  nearLimit.push({ id: `c${i}`, name: `Company ${i}`, country: "US", totalShipments: i * 10, latestShipmentDate: "2026-07-01" });
}
const report5 = validate(nearLimit, "broad query");
console.log(JSON.stringify(report5, null, 2));

// ─────── API FLOW DIAGRAM ───────
console.log();
console.log("=".repeat(78));
console.log("CAPTURE-MODE API FLOW");
console.log("=".repeat(78));
console.log(`
  POST /api/importyeti-paid/capture
  Body: { "query": "lavatory faucet", "hsCode": "8481.80" }

    1. Validates query parameter
    2. Reads IMPORTYETI_API_KEY and IMPORTYETI_API_URL from env
    3. Calls ImportYeti API:
       GET \${IMPORTYETI_API_URL}/search?q=lavatory+faucet&entity_type=importer&hs_code=8481.80&limit=50

    4. Validates response:
       - Field presence (10 expected fields)
       - Record counts (companies, shipments, websites)
       - Duplicate names
       - Sample companies (top 5 by shipments)

    5. Returns:
       {
         mode: "capture_only",
         status: "ok" | "warnings" | "blocked",
         report: { ...detailed validation... },
         rawPreview: { ...summary... }
       }

    6. Does NOT:
       - Update importyeti_web_entities
       - Update importyeti_web_relationships
       - Update buyer_monthly_rankings
       - Run qualification scoring

  After report.status === "ok":
    → Proceed to normal execution:
    POST /api/importyeti-paid { operation: "importyeti_company_search", parameters: { query: "lavatory faucet" } }
    POST /api/importyeti-paid/approve { requestId, approvedCost, approve: true }
    POST /api/importyeti-paid/execute { requestId, parameters: { query: "lavatory faucet" } }
`);

console.log("=".repeat(78));
console.log("DRY-RUN COMPLETE — all 5 scenarios validated");
console.log("=".repeat(78));
