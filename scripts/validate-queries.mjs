#!/usr/bin/env node
/**
 * Query validation report — Sprint 13.5
 *
 * Validates bathroom product queries before spending ImportYeti credits.
 * Analyzes existing D1 data, simulates expected results per query, and
 * recommends which queries to collect first.
 *
 * Usage:
 *   node scripts/validate-queries.mjs
 */

import { DatabaseSync } from "node:sqlite";
import { existsSync, readdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const stateDir = join(root, ".wrangler", "state", "v3", "d1", "miniflare-D1DatabaseObject");

function openDb() {
  if (!existsSync(stateDir)) { console.error("No local D1 state"); process.exit(1); }
  const files = readdirSync(stateDir)
    .filter(f => f.endsWith(".sqlite") && f !== "metadata.sqlite")
    .map(f => join(stateDir, f))
    .sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs);
  return new DatabaseSync(files.find(f => statSync(f).size > 0) || files[0]);
}

// ---------- Query dictionary (mirrors lib/products/bathroom-queries.ts) ----------
const BATHROOM_QUERIES = [
  {
    category: "bathroom_faucets",
    categoryName: "Bathroom Faucets",
    hsCode: "8481.80",
    queries: [
      "bathroom faucet", "lavatory faucet", "basin faucet", "vanity faucet",
      "widespread faucet", "faucet mixer", "bathroom tap", "single lever basin",
      "wall mount faucet",
    ],
    matchKeywords: [
      "bathroom faucet", "lavatory faucet", "basin faucet", "vanity faucet",
      "widespread faucet", "faucet mixer", "bathroom mixer", "basin mixer",
      "bathroom tap", "single lever basin", "single handle lavatory",
      "two handle lavatory", "wall mount faucet", "deck mount faucet",
      "vessel faucet", "sink faucet",
    ],
    excludeKeywords: [
      "kitchen faucet", "kitchen mixer", "kitchen sink", "pull down", "pull out",
      "bar faucet", "laundry faucet", "garden tap", "outdoor faucet",
      "industrial valve", "ball valve", "gate valve", "butterfly valve",
    ],
  },
  {
    category: "shower_systems",
    categoryName: "Shower Systems",
    hsCode: "3922.10",
    queries: [
      "shower system", "rain shower", "shower column", "hand shower",
      "shower head", "thermostatic shower", "shower panel", "shower set",
      "shower mixer",
    ],
    matchKeywords: [
      "shower system", "shower set", "rain shower", "shower head", "hand shower",
      "shower column", "shower mixer", "shower valve", "thermostatic shower",
      "shower kit", "shower panel",
    ],
    excludeKeywords: [
      "sauna", "steam room", "steam shower", "shower door", "shower enclosure",
      "shower curtain", "shower tray", "shower base", "shower pan", "shower stall",
    ],
  },
];

// ---------- ImportYeti credit estimates ----------
const TOTAL_CREDITS = 100;
const RESERVE = 25;
const AVAILABLE = TOTAL_CREDITS - RESERVE; // 75

// Estimated credits per ImportYeti Top 50 search page
// Conservative estimate based on typical scraping API pricing
const EST_CREDITS_PER_QUERY = 3;

// Expected importers per query (ImportYeti Top 50 pages return 15-30 importers)
const EXPECTED_IMPORTERS_LOW = 12;
const EXPECTED_IMPORTERS_MED = 20;
const EXPECTED_IMPORTERS_HIGH = 30;

function clamp(v, min, max) { return Math.min(max, Math.max(min, v)); }

function computeProductMatchConfidence(products, query) {
  if (!products) return 15;
  const lower = products.toLowerCase();
  const matchHits = query.matchKeywords.filter(k => lower.includes(k.toLowerCase())).length;
  const excludeHits = query.excludeKeywords.filter(k => lower.includes(k.toLowerCase())).length;
  let c = 0;
  if (matchHits >= 3) c = 95;
  else if (matchHits === 2) c = 80;
  else if (matchHits === 1) c = 60;
  else c = 30;
  c -= excludeHits * 20;
  return clamp(c, 5, 100);
}

// ---------- Main ----------
const db = openDb();

// Fetch all importers with their data
const importers = db.prepare(`
  SELECT e.id, e.name, e.total_shipments, e.latest_shipment_date,
         e.search_query, e.identity_confidence,
         (SELECT COUNT(*) FROM importyeti_web_relationships r WHERE r.importer_id = e.id) as supplier_count
  FROM importyeti_web_entities e
  WHERE e.entity_type = 'importer'
`).all();

const totalImporters = importers.length;
const withShipments = importers.filter(r => (r.total_shipments || 0) > 0).length;

console.log("=".repeat(85));
console.log("QUERY VALIDATION REPORT — Sprint 13.5");
console.log("=".repeat(85));
console.log(`Generated: ${new Date().toISOString()}`);
console.log(`Database: ${totalImporters} importers, ${withShipments} with shipment data`);
console.log();

// Build a lookup: existing search terms -> importers
const collectedByQuery = new Map();
for (const r of importers) {
  const q = r.search_query || "unknown";
  if (!collectedByQuery.has(q)) collectedByQuery.set(q, []);
  collectedByQuery.get(q).push(r);
}

// ---------- SECTION 1: Per-query validation ----------
console.log("=".repeat(85));
console.log("SECTION 1: QUERY-BY-QUERY VALIDATION");
console.log("=".repeat(85));

const allQueryResults = [];
let totalCreditsNeeded = 0;
const collectedQueries = new Set();
const newQueries = [];

for (const category of BATHROOM_QUERIES) {
  console.log(`\n${"-".repeat(85)}`);
  console.log(`CATEGORY: ${category.categoryName}  (HS ${category.hsCode})`);
  console.log(`${"-".repeat(85)}`);

  for (const query of category.queries) {
    // Check if we already collected this query
    const exactMatch = collectedByQuery.get(query) || [];
    const collected = exactMatch.length > 0;

    // Simulate expected results
    let existingConfirmed = 0;
    let existingCandidate = 0;
    let withData = 0;
    let totalCollected = exactMatch.length;

    for (const r of exactMatch) {
      if ((r.total_shipments || 0) > 0) withData++;
    }

    // For already-collected queries, analyze quality
    let relevanceScore = "N/A";
    let confidences = [];

    if (collected) {
      collectedQueries.add(query);

      const avgConf = exactMatch.reduce((sum, r) => {
        // We don't have products text in this query, so simulate
        // based on search_query and shipment data
        const hasProducts = (r.total_shipments || 0) > 0;
        const isBathroom = query.includes("faucet") || query.includes("shower") ||
                           query.includes("龙头") || query.includes("花洒") ||
                           query.includes("淋浴") || query.includes("bathroom") ||
                           query.includes("basin") || query.includes("lavatory") ||
                           query.includes("vanity") || query.includes("tap") ||
                           query.includes("mixer") || query.includes("bath");
        let conf = 15;
        if (hasProducts && isBathroom) conf = 75;
        else if (isBathroom) conf = 50;
        else if (hasProducts) conf = 40;
        confidences.push(conf);
        return sum + conf;
      }, 0);

      const avgMatchConf = Math.round(avgConf / exactMatch.length);
      existingConfirmed = exactMatch.filter(r => (r.total_shipments || 0) > 0).length;
      existingCandidate = totalCollected - existingConfirmed;

      // Classification
      const confirmRate = totalCollected > 0 ? Math.round(existingConfirmed / totalCollected * 100) : 0;
      if (confirmRate >= 70) relevanceScore = "GOOD ⬆";
      else if (confirmRate >= 40) relevanceScore = "MEDIUM →";
      else relevanceScore = "LOW ⬇";
    } else {
      newQueries.push({ query, category });
    }

    // Estimate credits
    const creditsNeeded = collected ? 0 : EST_CREDITS_PER_QUERY;
    totalCreditsNeeded += creditsNeeded;

    // Expected new buyers for uncollected queries
    const estBuyers = collected ? totalCollected : EXPECTED_IMPORTERS_MED;
    const estConfirmed = collected ? existingConfirmed : Math.round(estBuyers * 0.6);
    const estCandidates = estBuyers - estConfirmed;

    allQueryResults.push({
      category: category.categoryName,
      query,
      collected,
      existingTotal: totalCollected,
      existingConfirmed,
      existingCandidate: existingCandidate,
      relevanceScore,
      estBuyers,
      estConfirmed,
      estCandidates,
      creditsNeeded,
    });

    // Print row
    const status = collected ? "COLLECTED" : "NEW     ";
    const counts = collected
      ? `have ${totalCollected} (${existingConfirmed} conf, ${existingCandidate} cand)`
      : `est ~${estBuyers} (${estConfirmed} conf + ${estCandidates} cand)`;
    const cost = creditsNeeded > 0 ? `${creditsNeeded} cr` : "0 cr";

    console.log(`  ${status.padEnd(10)} ${query.padEnd(22)} ${counts.padEnd(45)} ${cost.padEnd(6)} ${relevanceScore}`);
  }
}

// ---------- SECTION 2: Summary ----------
console.log(`\n\n${"=".repeat(85)}`);
console.log("SECTION 2: COLLECTION SUMMARY");
console.log("=".repeat(85));

const totalQueries = BATHROOM_QUERIES.reduce((s, c) => s + c.queries.length, 0);
const collectedCount = collectedQueries.size;
const newCount = totalQueries - collectedCount;

console.log(`\n  Total queries in dictionary: ${totalQueries}`);
console.log(`  Already collected:           ${collectedCount}`);
console.log(`  Not yet collected:           ${newCount}`);
console.log(`  Estimated credits needed:    ${totalCreditsNeeded} of ${AVAILABLE} available (${Math.round(totalCreditsNeeded / AVAILABLE * 100)}% of spendable budget)`);

const budgetAfter = AVAILABLE - totalCreditsNeeded;
console.log(`  Budget remaining:            ${budgetAfter} credits (reserve: ${RESERVE})`);

const existingTotal = allQueryResults.filter(q => q.collected).reduce((s, q) => s + q.existingTotal, 0);
const estNewTotal = allQueryResults.filter(q => !q.collected).reduce((s, q) => s + q.estBuyers, 0);
const estTotalBuyers = existingTotal + estNewTotal;

console.log(`  Current unique importers:    ${totalImporters}`);
console.log(`  Estimated after collection: ${estTotalBuyers} (including potential overlap)`);

// ---------- SECTION 3: Query quality classification ----------
console.log(`\n\n${"=".repeat(85)}`);
console.log("SECTION 3: QUERY QUALITY CLASSIFICATION");
console.log("=".repeat(85));

let goodCount = 0, mediumCount = 0, badCount = 0, newCount2 = 0;

for (const r of allQueryResults) {
  if (!r.collected) { newCount2++; continue; }
  if (r.relevanceScore.startsWith("GOOD")) goodCount++;
  else if (r.relevanceScore.startsWith("MEDIUM")) mediumCount++;
  else badCount++;
}

console.log("\n  Collected queries:");
console.log(`    GOOD   (>70% confirmed): ${goodCount}`);
console.log(`    MEDIUM (40-70%):        ${mediumCount}`);
console.log(`    LOW    (<40%):          ${badCount}`);

// For new queries, estimate quality
console.log(`\n  New queries (${newCount2} remaining):`);
console.log("    Expected quality: GOOD-MEDIUM (specific bathroom terms → high relevance)");
console.log("    Risk: Some narrow terms (e.g. 'widespread faucet') may yield fewer results");

// High-risk queries
console.log("\n  Potential low-yield queries to watch:");
const narrowQueries = ["widespread faucet", "faucet mixer", "single lever basin", "wall mount faucet",
                        "shower column", "thermostatic shower"];
for (const q of newQueries) {
  if (narrowQueries.includes(q.query)) {
    console.log(`    ⚠ ${q.query} — very specific term, may yield <10 importers`);
  }
}

// ---------- SECTION 4: Credit efficiency ----------
console.log(`\n\n${"=".repeat(85)}`);
console.log("SECTION 4: CREDIT EFFICIENCY ESTIMATE");
console.log("=".repeat(85));

console.log("\n  Budget: 100 total credits, 25 reserved, 75 available.");
console.log("  Estimated: 3 credits per ImportYeti Top 50 search page.");
console.log();

// Group by collection status
const collectedResults = allQueryResults.filter(r => r.collected);
const newResults = allQueryResults.filter(r => !r.collected);

if (collectedResults.length > 0) {
  console.log("  Already collected (0 new credits):");
  const totalConf = collectedResults.reduce((s, r) => s + r.existingConfirmed, 0);
  const totalImp = collectedResults.reduce((s, r) => s + r.existingTotal, 0);
  const eff = totalImp > 0 ? Math.round(totalConf / totalImp * 100) : 0;
  console.log(`    ${collectedResults.length} queries → ${totalImp} importers (${totalConf} confirmed, ${eff}% efficient)`);
}

if (newResults.length > 0) {
  console.log("\n  Not yet collected:");
  const totalCredits = newResults.length * EST_CREDITS_PER_QUERY;
  const estTotal = newResults.reduce((s, r) => s + r.estBuyers, 0);
  const estConf = newResults.reduce((s, r) => s + r.estConfirmed, 0);
  const estEff = estTotal > 0 ? Math.round(estConf / estTotal * 100) : 0;

  console.log(`    ${newResults.length} queries × ${EST_CREDITS_PER_QUERY} credits = ${totalCredits} credits`);
  console.log(`    Conservative: ~${newResults.length * EXPECTED_IMPORTERS_LOW} importers`);
  console.log(`    Expected:     ~${estTotal} importers (${estConf} confirmed, ${estEff}% efficient)`);
  console.log(`    Optimistic:   ~${newResults.length * EXPECTED_IMPORTERS_HIGH} importers`);
  console.log(`    Cost per confirmed buyer: ~$${(totalCredits / Math.max(1, estConf)).toFixed(1)} credits`);
}

// ---------- SECTION 5: Collection strategy ----------
console.log(`\n\n${"=".repeat(85)}`);
console.log("SECTION 5: RECOMMENDED COLLECTION STRATEGY");
console.log("=".repeat(85));

console.log("\n  PHASE 1 — High-yield queries (run first, lowest risk):");

// Prioritize: already-collected (free to re-confirm), then high-volume common terms
const phase1 = [];
const phase2 = [];
const phase3 = [];

for (const q of allQueryResults) {
  if (q.collected) {
    // Already have data — keep but note
    if (q.existingConfirmed > 0) {
      phase1.push({ ...q, note: `(already have ${q.existingConfirmed} confirmed)` });
    }
  } else {
    const isBroad = ["shower system", "shower head", "shower set", "bathroom faucet",
                     "lavatory faucet", "basin faucet", "bathroom tap",
                     "hand shower", "rain shower", "shower mixer"].includes(q.query);
    const isNarrow = narrowQueries.includes(q.query);
    if (isBroad) phase2.push(q);
    else if (isNarrow) phase3.push(q);
    else phase2.push(q); // default to phase 2
  }
}

console.log("  Already collected (no credits needed):");
for (const q of phase1) {
  console.log(`    ✓ ${q.query.padEnd(22)} ${q.note}`);
}

const phase2Credits = phase2.length * EST_CREDITS_PER_QUERY;
console.log(`\n  PHASE 2 — Broad bathroom queries (${phase2.length} queries, ~${phase2Credits} credits):`);
for (const q of phase2) {
  console.log(`    → ${q.query}`);
}

const phase3Credits = phase3.length * EST_CREDITS_PER_QUERY;
console.log(`\n  PHASE 3 — Specific/narrow queries (${phase3.length} queries, ~${phase3Credits} credits, lower yield):`);
for (const q of phase3) {
  console.log(`    → ${q.query}`);
}

console.log(`\n  TOTAL: Phase 1 (free, already have) + Phase 2 (${phase2Credits} cr) + Phase 3 (${phase3Credits} cr) = ${phase2Credits + phase3Credits} new credits`);

// ---------- SECTION 6: Credit budget analysis ----------
console.log(`\n\n${"=".repeat(85)}`);
console.log("SECTION 6: BUDGET ANALYSIS");
console.log("=".repeat(85));

const newCreditsTotal = phase2Credits + phase3Credits;
const budgetPct = Math.round(newCreditsTotal / TOTAL_CREDITS * 100);
const availablePct = Math.round(newCreditsTotal / AVAILABLE * 100);

console.log(`\n  ImportYeti budget: ${TOTAL_CREDITS} credits total, ${AVAILABLE} credits available (${RESERVE} reserved)`);
console.log(`  Estimated cost:    ${newCreditsTotal} credits`);
console.log(`  % of total:        ${budgetPct}%`);
console.log(`  % of available:    ${availablePct}%`);

if (newCreditsTotal <= AVAILABLE) {
  console.log(`  Status:            APPROVED — within budget`);
} else {
  console.log(`  Status:            OVER BUDGET — need to prioritize`);
  console.log(`  Recommendation:    Run Phase 2 only (${phase2Credits} credits, ${Math.round(phase2Credits/AVAILABLE*100)}% of available)`);
}

console.log("\n  Phase 2-only cost:");
if (phase2Credits <= AVAILABLE) {
  console.log(`    ${phase2Credits} credits — fits easily within ${AVAILABLE} credit budget`);
  console.log(`    Leaves ${AVAILABLE - phase2Credits} credits for future collection`);
} else {
  console.log(`    ${phase2Credits} credits — needs reduction`);
}

// ---------- Existing vs expected gaps ----------
console.log(`\n\n${"=".repeat(85)}`);
console.log("SECTION 7: DATA GAPS & MISSING QUERIES");
console.log("=".repeat(85));

console.log("\n  Current data comes from these queries:");
const existingQueries = [...new Set(importers.map(r => r.search_query).filter(Boolean))];
for (const q of existingQueries) {
  const importers = (collectedByQuery.get(q) || []);
  const withData = importers.filter(r => (r.total_shipments || 0) > 0).length;
  console.log(`    "${q}": ${withData}/${importers.length} with shipments`);
}

console.log("\n  Queries NOT yet in our data (need collection):");
const allDefined = new Set();
for (const cat of BATHROOM_QUERIES) for (const q of cat.queries) allDefined.add(q);
const missing = [...allDefined].filter(q => !collectedByQuery.has(q));
missing.sort();
for (const q of missing) {
  console.log(`    ✗ ${q}`);
}

// ---------- Final recommendation ----------
console.log(`\n\n${"=".repeat(85)}`);
console.log("FINAL RECOMMENDATION");
console.log("=".repeat(85));

console.log(`
  COLLECT THESE QUERIES FIRST (Phase 2 — broad, high-volume):

  Bathroom Faucets:
    ${phase2.filter(q => q.category === "Bathroom Faucets").map(q => q.query).join("\n    ")}

  Shower Systems:
    ${phase2.filter(q => q.category === "Shower Systems").map(q => q.query).join("\n    ")}

  Estimated: ${phase2.length} queries × ~${EST_CREDITS_PER_QUERY} credits = ${phase2Credits} credits
  Expected:  ~${phase2.length * EXPECTED_IMPORTERS_LOW}-${phase2.length * EXPECTED_IMPORTERS_HIGH} importers

  HOLD THESE (Phase 3 — collect only if budget allows):
    ${phase3.map(q => `${q.query} (${q.category})`).join("\n    ")}

  DO NOT SPEND CREDITS ON:
    - Generic queries ("recent shipment importer") — 0% relevant
    - Queries already collected — use cache, don't re-collect
    - Full 18-query set at once — test Phase 2 first, check yield, then decide
`);

console.log("=".repeat(85));
console.log("END OF VALIDATION REPORT");
console.log("=".repeat(85));

db.close();
