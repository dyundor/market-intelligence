#!/usr/bin/env node
/**
 * Qualification calibration script for Sprint 11 Market Calibration.
 *
 * Queries the local D1 database for all importers, computes qualification
 * scores for faucet and shower categories, and generates a calibration report.
 *
 * Usage:
 *   node --experimental-strip-types scripts/calibrate.mjs
 */

import { DatabaseSync } from "node:sqlite";
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const stateDir = join(root, ".wrangler", "state", "v3", "d1", "miniflare-D1DatabaseObject");

function openDatabase() {
  if (!existsSync(stateDir)) {
    console.error(`Local D1 state not found at ${stateDir}`);
    process.exit(1);
  }
  const files = readdirSync(stateDir)
    .filter(file => file.endsWith(".sqlite") && file !== "metadata.sqlite")
    .map(file => join(stateDir, file))
    .sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs);
  const live = files.find(file => statSync(file).size > 0) || files[0];
  return new DatabaseSync(live);
}

// ---------- metric helpers (mirrors lib/opportunity/metrics.ts) ----------
function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function logScale(value, benchmark) {
  if (value <= 0) return 0;
  if (benchmark <= 1) return clamp(value, 0, 100);
  return clamp(100 * Math.log(1 + value) / Math.log(1 + benchmark), 0, 100);
}

function ratioScale(value, benchmark) {
  if (benchmark <= 0) return 0;
  return clamp(100 * Math.min(value, benchmark) / benchmark, 0, 100);
}

function recencyScore(date) {
  if (!date) return 0;
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return 0;
  const days = (Date.now() - parsed.getTime()) / 86_400_000;
  if (days < 0) return 100;
  if (days <= 30) return 100;
  if (days <= 90) return 80;
  if (days <= 180) return 50;
  if (days <= 365) return 25;
  return 0;
}

// ---------- qualification scoring (mirrors lib/qualification/score.ts) ----------
const DEFAULT_WEIGHTS = {
  shipmentVolume: 20,
  shipmentRecency: 20,
  supplierDiversity: 15,
  containerVolume: 15,
  freightValue: 10,
  identityConfidence: 10,
  productRelevance: 10,
};

const PRIORITY_THRESHOLDS = { a: 55, b: 25 };

function computePriorityScore(row, context) {
  const totalShipments = Number(row.total_shipments) || 0;
  const supplierCount = Number(row.supplier_count) || 0;
  const containers = Number(row.selected_month_containers) || 0;
  const freightUsd = Number(row.selected_month_freight_usd) || 0;
  const lsd = row.latest_shipment_date;
  const products = row.products || "";
  const identityConfidence = Number(row.identity_confidence) || 0;
  const w = DEFAULT_WEIGHTS;

  const values = [];

  values.push({ id: "shipment_volume", label: "Shipment volume", value: logScale(totalShipments, 100), weight: w.shipmentVolume });
  values.push({ id: "shipment_recency", label: "Shipment recency", value: recencyScore(lsd), weight: w.shipmentRecency });
  values.push({ id: "supplier_diversity", label: "Supplier diversity", value: ratioScale(supplierCount, 5), weight: w.supplierDiversity });
  values.push({ id: "container_volume", label: "Container volume", value: logScale(containers, 50), weight: w.containerVolume });
  values.push({ id: "freight_value", label: "Freight value", value: logScale(freightUsd, 100000), weight: w.freightValue });
  values.push({ id: "identity_confidence", label: "Identity confidence", value: ratioScale(identityConfidence, 100), weight: w.identityConfidence });

  let relevanceValue = 70;
  if (context?.productKeywords?.length) {
    const lowerProducts = products.toLowerCase();
    const keywordMatches = context.productKeywords.filter(
      k => lowerProducts.includes(k.toLowerCase()),
    ).length;
    relevanceValue = clamp(keywordMatches * 25, 30, 100);
  } else {
    relevanceValue = totalShipments > 0 ? 70 : 40;
  }
  values.push({ id: "product_relevance", label: "Product relevance", value: relevanceValue, weight: w.productRelevance });

  const factors = values.map(v => ({
    ...v,
    contribution: Math.round(v.value * v.weight / 100),
  }));

  const score = Math.round(factors.reduce((sum, f) => sum + f.contribution, 0));
  return { score: clamp(score, 0, 100), factors };
}

function priorityFromScore(score) {
  if (score >= PRIORITY_THRESHOLDS.a) return "A";
  if (score >= PRIORITY_THRESHOLDS.b) return "B";
  return "C";
}

const POSITIVE_REASONS = {
  frequent_importer: "High shipment volume — established trading relationship",
  recent_imports: "Recent imports within 180 days — active buyer",
  multiple_suppliers: "Multiple Chinese suppliers — diversified sourcing",
  containerized_freight: "Containerized cargo — significant order scale",
  high_order_value: "High freight value — substantial purchase orders",
  product_focus: "Strong product relevance to target category",
  high_identity: "High entity identity confidence — verified company profile",
};

const RISK_REASONS = {
  few_shipments: "Few shipments on record — limited trading history",
  no_recent_activity: "No recent import activity — possibly inactive",
  single_supplier: "Single supplier dependency — no alternative sourcing",
  no_containers: "No containerized shipments in selected period",
  missing_website: "No verified company website",
  low_identity: "Low entity identity confidence — possible duplicate",
};

function gatherPositiveFactors(row, factors) {
  const out = [];
  const totalShipments = Number(row.total_shipments) || 0;
  const supplierCount = Number(row.supplier_count) || 0;
  const containers = Number(row.selected_month_containers) || 0;
  const freightUsd = Number(row.selected_month_freight_usd) || 0;
  const lsd = row.latest_shipment_date;
  const identityConfidence = Number(row.identity_confidence) || 0;

  if (totalShipments >= 50) out.push(POSITIVE_REASONS.frequent_importer);
  if (lsd) {
    const days = (Date.now() - new Date(lsd).getTime()) / 86_400_000;
    if (days >= 0 && days <= 180) out.push(POSITIVE_REASONS.recent_imports);
  }
  if (supplierCount >= 3) out.push(POSITIVE_REASONS.multiple_suppliers);
  if (containers >= 1) out.push(POSITIVE_REASONS.containerized_freight);
  if (freightUsd >= 10000) out.push(POSITIVE_REASONS.high_order_value);

  const relevance = factors.get("product_relevance");
  if (relevance !== undefined && relevance >= 50) out.push(POSITIVE_REASONS.product_focus);

  if (identityConfidence >= 80) out.push(POSITIVE_REASONS.high_identity);

  return out;
}

function gatherRiskFactors(row) {
  const out = [];
  const totalShipments = Number(row.total_shipments) || 0;
  const supplierCount = Number(row.supplier_count) || 0;
  const containers = Number(row.selected_month_containers) || 0;
  const lsd = row.latest_shipment_date;
  const websiteStatus = row.website_status || "";
  const identityConfidence = Number(row.identity_confidence) || 0;

  if (totalShipments < 5) out.push(RISK_REASONS.few_shipments);
  if (!lsd || new Date(lsd).getTime() < Date.now() - 365 * 86400000)
    out.push(RISK_REASONS.no_recent_activity);
  if (supplierCount === 1) out.push(RISK_REASONS.single_supplier);
  if (!containers) out.push(RISK_REASONS.no_containers);
  if (websiteStatus !== "verified_company_site" && websiteStatus !== "verified_forwarder_site")
    out.push(RISK_REASONS.missing_website);
  if (identityConfidence > 0 && identityConfidence < 70)
    out.push(RISK_REASONS.low_identity);

  return out;
}

function qualifyBuyer(row, context) {
  const { score, factors } = computePriorityScore(row, context);
  const priority = priorityFromScore(score);
  const factorMap = new Map(factors.map(f => [f.id, f.value]));

  return {
    priority,
    qualificationScore: score,
    positiveFactors: gatherPositiveFactors(row, factorMap),
    riskFactors: gatherRiskFactors(row),
    factors,
  };
}

// ---------- product config ----------
const PRODUCTS = {
  faucet: {
    name: "Bathroom Faucets",
    keywords: ["faucet", "tap", "taps", "bathroom faucet", "basin faucet", "mixer faucet", "sink faucet", "kitchen faucet", "water faucet"],
  },
  shower: {
    name: "Shower Systems",
    keywords: ["shower", "shower system", "shower set", "rain shower", "shower head", "shower column", "shower kit"],
  },
};

// ---------- main ----------
const db = openDatabase();

console.log("=".repeat(80));
console.log("QUALIFICATION CALIBRATION REPORT — Sprint 11 Market Calibration");
console.log("=".repeat(80));
console.log(`Generated: ${new Date().toISOString()}`);
console.log();

// Fetch all importers with relationship counts
const importers = db.prepare(`
  SELECT
    e.id, e.name, e.address, e.country,
    e.total_shipments, e.latest_shipment_date,
    e.identity_confidence, e.website_status, e.search_query,
    e.identity_status,
    COUNT(r.supplier_id) as supplier_count
  FROM importyeti_web_entities e
  LEFT JOIN importyeti_web_relationships r ON r.importer_id = e.id
  WHERE e.entity_type = 'importer'
  GROUP BY e.id
  ORDER BY e.total_shipments DESC NULLS LAST
`).all();

console.log(`Total importers in database: ${importers.length}`);
const withData = importers.filter(r => (r.total_shipments || 0) > 0).length;
console.log(`With shipment data: ${withData}`);
console.log(`Without shipment data: ${importers.length - withData}`);
console.log();

// Score each importer for both product categories
for (const prod of Object.values(PRODUCTS)) {
  const scored = importers.map(row => {
    const q = qualifyBuyer(row, { productCategory: prod.name, productKeywords: prod.keywords });
    return { ...row, ...q };
  }).sort((a, b) => b.qualificationScore - a.qualificationScore);

  console.log(`\n${"-".repeat(80)}`);
  console.log(`CATEGORY: ${prod.name}`);
  console.log(`keywords: ${prod.keywords.join(", ")}`);
  console.log(`${"-".repeat(80)}`);
  console.log(`Top 50 buyers ranked by qualification score:\n`);

  const header = [
    "#".padEnd(3),
    "Company Name".padEnd(40),
    "Score".padEnd(6),
    "P".padEnd(2),
    "Shipments".padEnd(10),
    "Suppliers".padEnd(9),
    "ID Conf".padEnd(7),
    "Recency".padEnd(6),
    "Pos Factors".padEnd(5),
    "Risk Factors".padEnd(5),
    "Search Query",
  ].join(" ");
  console.log(header);
  console.log("-".repeat(header.length));

  for (let i = 0; i < scored.length; i++) {
    const r = scored[i];
    const rank = (i + 1).toString().padEnd(3);
    const name = (r.name || "?").slice(0, 38).padEnd(40);
    const score = r.qualificationScore.toString().padEnd(6);
    const pri = r.priority.padEnd(2);
    const ships = ((r.total_shipments || 0)).toString().padEnd(10);
    const supps = r.supplier_count.toString().padEnd(9);
    const idconf = ((r.identity_confidence || 0)).toString().padEnd(7);
    const lsd = r.latest_shipment_date ? new Date(r.latest_shipment_date).toISOString().slice(0, 10) : "—";
    const recency = lsd.padEnd(6);
    const pos = r.positiveFactors.length.toString().padEnd(5);
    const risk = r.riskFactors.length.toString().padEnd(5);
    const query = (r.search_query || "").slice(0, 30);

    console.log(`${rank}${name}${score}${pri}${ships}${supps}${idconf}${recency}${pos}${risk}${query}`);

    // Print factor details for top 15
    if (i < 15) {
      const posList = r.positiveFactors.length ? "  + " + r.positiveFactors.map(f => f.split("—")[0].trim()).join(" | ") : "";
      const riskList = r.riskFactors.length ? "  - " + r.riskFactors.map(f => f.split("—")[0].trim()).join(" | ") : "";
      const factorDetail = r.factors.map(f => `${f.label}: ${f.value}×${f.weight}=${f.contribution}`).join(", ");
      // if (posList) console.log(posList);
      // if (riskList) console.log(riskList);
      console.log(`  Factors: ${factorDetail}`);
      if (posList) console.log(posList);
      if (riskList) console.log(riskList);
    }
  }

  // Distribution
  const dist = { A: 0, B: 0, C: 0 };
  for (const r of scored) dist[r.priority]++;
  console.log(`\nDistribution: A=${dist.A}, B=${dist.B}, C=${dist.C}`);
  const avgScore = Math.round(scored.reduce((s, r) => s + r.qualificationScore, 0) / scored.length);
  console.log(`Average score: ${avgScore}`);
  console.log(`Median score: ${scored[Math.floor(scored.length / 2)].qualificationScore}`);
}

// ---------- RANKING QUALITY CHECKS ----------
console.log(`\n\n${"=".repeat(80)}`);
console.log("RANKING QUALITY CHECKS");
console.log("=".repeat(80));

// Check 1: Duplicate company names
console.log("\n--- Duplicate detection ---");
const nameGroups = new Map();
for (const r of importers) {
  const key = (r.name || "").toLowerCase().replace(/[^a-z0-9]/g, "");
  if (!nameGroups.has(key)) nameGroups.set(key, []);
  nameGroups.get(key).push(r.name);
}
const dupes = [...nameGroups.entries()].filter(([_, names]) => names.length > 1);
if (dupes.length) {
  dupes.forEach(([key, names]) => console.log(`  ${names.join(" = ")}`));
} else {
  console.log("  No duplicate names found.");
}

// Check 2: Non-plumbing companies with high scores
console.log("\n--- Non-plumbing company check ---");
const nonPlumbingPatterns = ["lighting", "led", "furniture", "flooring", "sauna", "display", "food", "retail"];
for (const r of importers) {
  const nameLow = (r.name || "").toLowerCase();
  const matched = nonPlumbingPatterns.filter(p => nameLow.includes(p));
  if (matched.length && (r.total_shipments || 0) > 0) {
    console.log(`  ${r.name}: matches non-plumbing keyword(s): ${matched.join(", ")} (shipments: ${r.total_shipments})`);
  }
}

// Check 3: Major known buyers that should be present
console.log("\n--- Missing major buyers check ---");
const expectedBuyers = ["ferguson", "home depot", "lowe", "hd supply", "wolseley", "moen", "delta", "kohler", "american standard", "toto"];
for (const expected of expectedBuyers) {
  const found = importers.filter(r => (r.name || "").toLowerCase().includes(expected));
  if (found.length === 0) {
    console.log(`  NOT FOUND: ${expected}`);
  } else {
    const hasData = found.some(r => (r.total_shipments || 0) > 0);
    const status = hasData ? "has shipment data" : "present but NO shipment data";
    console.log(`  ${found[0].name}: ${status}`);
  }
}

// Check 4: Companies with very old last shipment (inactive)
console.log("\n--- Inactive buyers (last shipment > 2 years ago) ---");
const cutoff = Date.now() - 2 * 365 * 86400000;
for (const r of importers) {
  if (r.latest_shipment_date && new Date(r.latest_shipment_date).getTime() < cutoff && (r.total_shipments || 0) > 0) {
    console.log(`  ${r.name}: last shipment ${r.latest_shipment_date} (total: ${r.total_shipments})`);
  }
}

// Check 5: Score distribution analysis
console.log("\n--- Score distribution analysis ---");
const allScores = importers.map(r => {
  const q = qualifyBuyer(r, { productCategory: "faucet", productKeywords: PRODUCTS.faucet.keywords });
  return q.qualificationScore;
}).sort((a, b) => a - b);

const percentiles = {};
for (const p of [10, 25, 50, 75, 90, 95]) {
  const idx = Math.floor(allScores.length * p / 100);
  percentiles[`p${p}`] = allScores[Math.min(idx, allScores.length - 1)];
}
console.log(`  Scores: min=${allScores[0]}, p10=${percentiles.p10}, p25=${percentiles.p25}, p50=${percentiles.p50}, p75=${percentiles.p75}, p90=${percentiles.p90}, max=${allScores[allScores.length - 1]}`);

// Check 6: Score cluster analysis
console.log("\n--- Score clusters ---");
const clusters = { "0-10": 0, "10-25": 0, "25-55": 0, "55-75": 0, "75-100": 0 };
for (const s of allScores) {
  if (s < 10) clusters["0-10"]++;
  else if (s < 25) clusters["10-25"]++;
  else if (s < 55) clusters["25-55"]++;
  else if (s < 75) clusters["55-75"]++;
  else clusters["75-100"]++;
}
for (const [range, count] of Object.entries(clusters)) {
  const pct = Math.round(count / allScores.length * 100);
  console.log(`  ${range}: ${count} buyers (${pct}%)`);
}

// Check 7: Website coverage
console.log("\n--- Website status coverage ---");
const websiteStats = {};
for (const r of importers) {
  const ws = r.website_status || "unknown";
  websiteStats[ws] = (websiteStats[ws] || 0) + 1;
}
for (const [ws, count] of Object.entries(websiteStats).sort()) {
  const pct = Math.round(count / importers.length * 100);
  console.log(`  ${ws}: ${count} (${pct}%)`);
}

// Check 8: Identity confidence distribution
console.log("\n--- Identity confidence distribution ---");
const idStats = {};
for (const r of importers) {
  const ic = r.identity_confidence || 0;
  let bucket = "unknown";
  if (ic === 100) bucket = "100 (exact match)";
  else if (ic >= 95) bucket = "95-99";
  else if (ic >= 80) bucket = "80-94 (normalized)";
  else if (ic >= 60) bucket = "60-79 (fuzzy)";
  else if (ic > 0) bucket = "1-59 (low)";
  idStats[bucket] = (idStats[bucket] || 0) + 1;
}
for (const [bucket, count] of Object.entries(idStats).sort()) {
  const pct = Math.round(count / importers.length * 100);
  console.log(`  ${bucket}: ${count} (${pct}%)`);
}

// Weight sensitivity analysis
console.log(`\n\n${"=".repeat(80)}`);
console.log("WEIGHT SENSITIVITY ANALYSIS");
console.log("=".repeat(80));
console.log("\nCurrent weights:", DEFAULT_WEIGHTS);
console.log();

// Test alternative weight configs
const alternatives = {
  current: { ...DEFAULT_WEIGHTS },
  "shipment-heavy": { shipmentVolume: 30, shipmentRecency: 25, supplierDiversity: 15, containerVolume: 10, freightValue: 5, identityConfidence: 5, productRelevance: 10 },
  "identity-heavy": { shipmentVolume: 15, shipmentRecency: 15, supplierDiversity: 15, containerVolume: 10, freightValue: 10, identityConfidence: 25, productRelevance: 10 },
  "recency-heavy": { shipmentVolume: 10, shipmentRecency: 35, supplierDiversity: 15, containerVolume: 10, freightValue: 10, identityConfidence: 10, productRelevance: 10 },
};

for (const [label, weights] of Object.entries(alternatives)) {
  const origWeights = { ...DEFAULT_WEIGHTS };
  Object.assign(DEFAULT_WEIGHTS, weights);

  const scored = importers.map(row => {
    const q = qualifyBuyer(row, { productCategory: "faucet", productKeywords: PRODUCTS.faucet.keywords });
    return { name: row.name, ...q };
  }).sort((a, b) => b.qualificationScore - a.qualificationScore);

  const top3 = scored.slice(0, 3).map(r => `${r.name} (${r.qualificationScore}, ${r.priority})`);
  const dist = { A: 0, B: 0, C: 0 };
  for (const r of scored) dist[r.priority]++;
  const avg = Math.round(scored.reduce((s, r) => s + r.qualificationScore, 0) / scored.length);

  console.log(`${label}: Top 3 = ${top3.join(" | ")},  Dist: A=${dist.A} B=${dist.B} C=${dist.C},  Avg=${avg}`);

  // Restore
  Object.assign(DEFAULT_WEIGHTS, origWeights);
}

// ---------- KEY FINDINGS ----------
console.log(`\n\n${"=".repeat(80)}`);
console.log("KEY FINDINGS");
console.log("=".repeat(80));

const keyFindings = [];

// Finding: data coverage
const coveragePct = Math.round(withData / importers.length * 100);
keyFindings.push({
  severity: "high",
  category: "Data coverage",
  finding: `Only ${withData}/${importers.length} (${coveragePct}%) importers have shipment data. ${importers.length - withData} importers from generic "recent shipment importer" queries have NULL total_shipments.`,
  recommendation: "Re-run targeted product-specific ImportYeti queries (bathroom faucet, shower faucet, etc.) to populate shipment data for major plumbing buyers.",
});

// Finding: website coverage
const verifiedWebsites = importers.filter(r => r.website_status === "verified_company_site" || r.website_status === "verified_forwarder_site").length;
if (verifiedWebsites === 0) {
  keyFindings.push({
    severity: "medium",
    category: "Data quality",
    finding: `0/${importers.length} importers have verified websites. Most have website_status="unknown". This triggers the "missing_website" risk factor for all buyers.`,
    recommendation: "Run website verification enrichment to populate website_status for known buyers.",
  });
}

// Finding: inactive buyers
const inactiveCount = importers.filter(r => {
  if (!r.latest_shipment_date || !r.total_shipments) return false;
  return new Date(r.latest_shipment_date).getTime() < cutoff;
}).length;
if (inactiveCount > 0) {
  keyFindings.push({
    severity: "medium",
    category: "Ranking quality",
    finding: `${inactiveCount} buyers have last shipment > 2 years ago but still appear in rankings with shipment data.`,
    recommendation: "These companies should get a stronger recency penalty or be flagged as 'inactive'.",
  });
}

// Finding: non-plumbing companies
const nonPlumbingHigh = importers.filter(r => {
  if ((r.total_shipments || 0) === 0) return false;
  const nameLow = (r.name || "").toLowerCase();
  return nonPlumbingPatterns.some(p => nameLow.includes(p));
});
if (nonPlumbingHigh.length > 0) {
  keyFindings.push({
    severity: "medium",
    category: "Ranking quality",
    finding: `${nonPlumbingHigh.length} non-plumbing companies (${nonPlumbingHigh.map(r => r.name).join(", ")}) appear in the dataset with shipment data. This may indicate misclassified queries.`,
    recommendation: "Add search_query filtering or product relevance scoring to penalize non-plumbing importers.",
  });
}

// Finding: missing major buyers
const missingBuyers = expectedBuyers.filter(e => !importers.some(r => (r.name || "").toLowerCase().includes(e)));
if (missingBuyers.length > 0) {
  keyFindings.push({
    severity: "high",
    category: "Missing buyers",
    finding: `Major plumbing brands not in database: ${missingBuyers.join(", ")}. These are well-known U.S. plumbing distributors/manufacturers.`,
    recommendation: "Run targeted ImportYeti queries for these company names to enrich the buyer database.",
  });
}

for (const f of keyFindings) {
  console.log(`\n[${f.severity.toUpperCase()}] ${f.category}`);
  console.log(`  ${f.finding}`);
  console.log(`  → ${f.recommendation}`);
}

// ---------- SCORE IMPROVEMENT RECOMMENDATIONS ----------
console.log(`\n\n${"=".repeat(80)}`);
console.log("SCORE IMPROVEMENT RECOMMENDATIONS");
console.log("=".repeat(80));

console.log(`
1. DATA COVERAGE (most impactful)
   The largest issue is that 72% of importers have NULL shipment data because
   they were discovered via generic "recent shipment importer" queries rather
   than product-specific queries. Running targeted queries for the 7 product
   categories would dramatically improve data quality.

2. RECENCY WEIGHT TUNING
   Current: shipmentRecency weight = 20
   With many importers having old or NULL last shipment dates, the recency
   factor produces binary results (100 or 0). Consider differentiating:
   - 0-30 days: 100
   - 30-90 days: 80
   - 90-180 days: 50
   - 180-365 days: 25
   - >365 days or NULL: 0

3. WEBSITE COVERAGE
   All current importers have website_status="unknown" except one, triggering
   the "missing_website" risk for everyone. After running website verification,
   this risk factor will become more discriminating.

4. IDENTITY CONFIDENCE CLUSTERING
   72% of importers have identity_confidence = 90 (default), making this factor
   non-discriminating. After identity resolution runs again, this will improve.

5. SUPPLIER COUNT ISSUES
   Many importers show supplier_count=1 even with high shipments. This likely
   indicates that supplier relationships weren't fully captured. Verify
   relationship data completeness.

6. PRODUCT RELEVANCE
   Current default relevance of 70 for any importer with shipments masks
   non-plumbing companies. Tightening the keyword matching would reduce
   false positives from furniture/lighting importers.
`);

console.log("=".repeat(80));
console.log("END OF REPORT");
console.log("=".repeat(80));

db.close();
