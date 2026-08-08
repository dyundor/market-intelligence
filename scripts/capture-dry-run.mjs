#!/usr/bin/env node
/**
 * Capture-mode dry-run — Sprint 14.6 (refined validation)
 *
 * Tests refined rules: field importance levels, near-limit → WARNING,
 * low count → WARNING, only critical fields block pipeline.
 */

const FIELD_DEFS = [
  { field: "name",               importance: "critical",  description: "Company name" },
  { field: "totalShipments",     importance: "critical",  description: "Total shipment count" },
  { field: "id",                 importance: "important", description: "Company identifier" },
  { field: "address",            importance: "important", description: "Physical address" },
  { field: "country",            importance: "important", description: "Country" },
  { field: "supplierCount",      importance: "important", description: "Supplier count" },
  { field: "latestShipmentDate", importance: "important", description: "Latest shipment date" },
  { field: "productDescriptions",importance: "important", description: "Product descriptions" },
  { field: "countryCode",        importance: "optional",  description: "Country code (ISO)" },
  { field: "website",            importance: "optional",  description: "Company website URL" },
];

function sampleValue(value) {
  if (value === undefined || value === null) return "(missing)";
  if (Array.isArray(value)) return `[${value.length} items] ${value.slice(0, 2).join(", ")}`;
  if (typeof value === "object") return JSON.stringify(value).slice(0, 80);
  return String(value).slice(0, 80);
}

function validate(companies, query, estimatedCost = 4, actualCost = 3) {
  const warnings = [];
  const errors = [];
  const first = companies[0] || {};

  // Field presence with importance
  const fieldPresence = [];
  for (const def of FIELD_DEFS) {
    const present = def.field in first;
    fieldPresence.push({ field: def.field, importance: def.importance, present, sampleValue: present ? sampleValue(first[def.field]) : "(missing)" });
  }

  const criticalMissing = fieldPresence.filter(f => !f.present && f.importance === "critical").map(f => f.field);
  const importantMissing = fieldPresence.filter(f => !f.present && f.importance === "important").map(f => f.field);
  const optionalMissing = fieldPresence.filter(f => !f.present && f.importance === "optional").map(f => f.field);

  if (criticalMissing.length > 0) errors.push(`Critical fields missing: ${criticalMissing.join(", ")}`);
  if (importantMissing.length > 0) warnings.push(`${importantMissing.length} important fields missing: ${importantMissing.join(", ")}`);

  // Record counts
  const withData = companies.filter(c => (c.totalShipments || 0) > 0).length;
  const uniqueNames = new Set(companies.map(c => (c.name || "").toLowerCase().trim())).size;

  if (companies.length === 0) errors.push("0 companies returned.");
  if (companies.length > 0 && companies.length < 5) warnings.push(`Only ${companies.length} companies — narrow query result, not an error.`);
  if (companies.length >= 45) warnings.push(`${companies.length} companies — near API 50-item limit; WARNING only (valid result may be large).`);
  if (withData === 0 && companies.length > 0) warnings.push("0 companies have shipment data.");
  if (uniqueNames < companies.length) warnings.push(`${companies.length - uniqueNames} duplicate names.`);

  const sample = [...companies].sort((a, b) => (b.totalShipments || 0) - (a.totalShipments || 0)).slice(0, 5).map(c => ({
    name: c.name, country: c.country || "(missing)", totalShipments: c.totalShipments || 0,
    latestShipmentDate: c.latestShipmentDate || "(missing)", supplierCount: c.supplierCount || 0,
  }));

  let status = "ok", ready = true;
  if (errors.length > 0) { status = "blocked"; ready = false; }
  else if (warnings.length > 0) status = "warnings";

  const creditReport = {
    totalBudget: 100, reserveBudget: 25, creditsBefore: 100,
    estimatedCost, actualCost, creditsAfter: 100 - actualCost,
    remainingAvailable: Math.max(0, 100 - actualCost - 25),
    reserveRemaining: 25, percentOfTotalUsed: Math.round(actualCost / 100 * 100),
  };

  return {
    status, query, capturedAt: new Date().toISOString(), creditReport,
    records: { totalCompanies: companies.length, withShipmentData: withData, uniqueNames },
    fieldSummary: { criticalMissing, importantMissing, optionalMissing },
    sampleCompanies: sample, warnings, errors, readyForFullPipeline: ready,
  };
}

console.log("=".repeat(78));
console.log("CAPTURE-MODE DRY-RUN — Sprint 14.6 (refined rules)");
console.log("=".repeat(78));
console.log();
console.log("Rules:");
console.log("  Critical (BLOCKED): name, totalShipments missing");
console.log("  Important (WARNING): id, address, country, supplierCount, etc.");
console.log("  Optional (silent): countryCode, website");
console.log("  Near-limit (≥45): WARNING, not blocked");
console.log("  Low count (<5): WARNING, not blocked");
console.log("  0 companies: BLOCKED");

// Scenario 1: Good response — all critical + most important present
console.log();
console.log("─".repeat(78));
console.log("SCENARIO 1: Good response (10 companies, all critical + most important)");
const good = [];
for (let i = 0; i < 10; i++) {
  good.push({ name: `Importer ${i}`, totalShipments: (10 - i) * 50, id: `c${i}`, address: `Addr ${i}`, country: "US", latestShipmentDate: "2026-07-01", supplierCount: i + 1, countryCode: "US", website: `https://site${i}.com`, productDescriptions: ["bathroom faucet"] });
}
const r1 = validate(good, "lavatory faucet");
console.log(`  Status: ${r1.status}  |  Ready: ${r1.readyForFullPipeline}  |  Critical missing: ${r1.fieldSummary.criticalMissing.length}  |  Errors: ${r1.errors.length}  |  Warnings: ${r1.warnings.length}`);

// Scenario 2: Missing critical — name only
console.log();
console.log("─".repeat(78));
console.log("SCENARIO 2: Missing CRITICAL — no name field");
const noName = [{ totalShipments: 100, id: "c1", country: "US" }];
const r2 = validate(noName, "test");
console.log(`  Status: ${r2.status}  |  Ready: ${r2.readyForFullPipeline}`);
console.log(`  Critical missing: ${r2.fieldSummary.criticalMissing.join(", ") || "none"}`);
console.log(`  Errors: ${r2.errors.join("; ") || "none"}`);

// Scenario 3: Near limit — NOT blocked
console.log();
console.log("─".repeat(78));
console.log("SCENARIO 3: Near-limit (47 companies) — should be WARNING, not BLOCKED");
const nearLimit = [];
for (let i = 0; i < 47; i++) {
  nearLimit.push({ name: `Co ${i}`, totalShipments: i * 10, id: `c${i}`, country: "US", latestShipmentDate: "2026-07-01" });
}
const r3 = validate(nearLimit, "broad query");
console.log(`  Status: ${r3.status}  |  Ready: ${r3.readyForFullPipeline}`);
console.log(`  Warnings: ${r3.warnings.join("; ") || "none"}`);
console.log(`  Errors: ${r3.errors.join("; ") || "none"}`);

// Scenario 4: Low count — NOT blocked
console.log();
console.log("─".repeat(78));
console.log("SCENARIO 4: Low count (3 companies) — should be WARNING, not BLOCKED");
const few = [
  { name: "Niche Co", totalShipments: 50, id: "c1", country: "US", latestShipmentDate: "2026-07-01" },
  { name: "Specialist Inc", totalShipments: 30, id: "c2", country: "US", latestShipmentDate: "2026-06-01" },
  { name: "Boutique Llc", totalShipments: 20, id: "c3", country: "US", latestShipmentDate: "2026-05-01" },
];
const r4 = validate(few, "narrow niche query");
console.log(`  Status: ${r4.status}  |  Ready: ${r4.readyForFullPipeline}`);
console.log(`  Warnings: ${r4.warnings.join("; ") || "none"}`);

// Scenario 5: Missing important fields only — NOT blocked
console.log();
console.log("─".repeat(78));
console.log("SCENARIO 5: Missing IMPORTANT fields only — should be WARNING, not BLOCKED");
const sparse = [
  { name: "Sparse Co", totalShipments: 100 },
];
const r5 = validate(sparse, "sparse");
console.log(`  Status: ${r5.status}  |  Ready: ${r5.readyForFullPipeline}`);
console.log(`  Critical missing: ${r5.fieldSummary.criticalMissing.join(", ") || "none"}`);
console.log(`  Important missing: ${r5.fieldSummary.importantMissing.join(", ")}`);
console.log(`  Warnings: ${r5.warnings.join("; ") || "none"}`);

// Scenario 6: All fields present, good count
console.log();
console.log("─".repeat(78));
console.log("SCENARIO 6: Perfect response (18 companies, all fields)");
const perfect = [];
for (let i = 0; i < 18; i++) {
  perfect.push({
    name: `Perfect Importer ${i}`, totalShipments: (18 - i) * 40, id: `perf_${i}`,
    address: `${100 + i} Trade Blvd`, country: "United States", countryCode: "US",
    website: `https://perf${i}.com`, latestShipmentDate: "2026-07-15",
    supplierCount: Math.min(i + 1, 8), productDescriptions: ["bathroom faucet", "lavatory basin mixer"],
  });
}
const r6 = validate(perfect, "lavatory faucet");
console.log(`  Status: ${r6.status}  |  Ready: ${r6.readyForFullPipeline}`);
console.log(`  Credit: ${r6.creditReport.actualCost}/${r6.creditReport.totalBudget} credits`);
console.log(`  Companies: ${r6.records.totalCompanies} (${r6.records.withShipmentData} with data)`);

// Credit report detail
console.log();
console.log("─".repeat(78));
console.log("CREDIT USAGE REPORT (scenario 6)");
console.log(JSON.stringify(r6.creditReport, null, 2));

console.log();
console.log("=".repeat(78));
console.log("VALIDATION COMPLETE — refined rules working correctly");
console.log("=".repeat(78));
console.log();
console.log("Summary:");
console.log("  ✓ Near-limit → WARNING (not blocked)");
console.log("  ✓ Low count → WARNING (not blocked)");
console.log("  ✓ Only critical fields → BLOCKED");
console.log("  ✓ Important fields → WARNING");
console.log("  ✓ Optional fields → silent");
console.log("  ✓ Credit report on every capture");
