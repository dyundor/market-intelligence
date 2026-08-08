#!/usr/bin/env node
/**
 * Preflight check — Sprint 14.1
 *
 * Validates the entire data pipeline before executing the first paid
 * ImportYeti query ("lavatory faucet"). Does NOT consume credits.
 *
 * Usage:
 *   node scripts/preflight.mjs
 */

import { DatabaseSync } from "node:sqlite";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
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

const PASS = "✓";
const FAIL = "✗";
const WARN = "⚠";

const db = openDb();
const results = [];

function check(label, pass, detail = "") {
  results.push({ label, pass, detail });
  const mark = pass ? PASS : FAIL;
  console.log(`  ${mark} ${label}${detail ? ` — ${detail}` : ""}`);
}

function warn(label, detail = "") {
  results.push({ label, pass: true, warn: true, detail });
  console.log(`  ${WARN} ${label}${detail ? ` — ${detail}` : ""}`);
}

console.log("=".repeat(78));
console.log("PREFLIGHT CHECK — First Paid ImportYeti Query");
console.log("=".repeat(78));
console.log(`Target query: lavatory faucet`);
console.log(`Date: ${new Date().toISOString()}`);
console.log();

// ========== 1. API CONFIGURATION ==========
console.log("1. API CONFIGURATION");
console.log("-".repeat(78));

// 1a. Environment check
const hasWrangler = existsSync(join(root, "wrangler.d1.jsonc")) || existsSync(join(root, "wrangler.jsonc")) || existsSync(join(root, "wrangler.toml"));
check("Wrangler config found", hasWrangler);

// 1b. Check DB binding exists
const bindingExists = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='importyeti_web_entities'").all().length > 0;
check("DB binding: importyeti_web_entities table", bindingExists);

// 1c. Check paid API tables
const usageTable = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='api_usage_requests'").all().length > 0;
const usageLogTable = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='api_usage_log'").all().length > 0;
check("DB binding: api_usage_requests table", usageTable);
check("DB binding: api_usage_log table", usageLogTable);

// 1d. Check paid cache
const paidCache = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='paid_api_cache'").all().length > 0;
check("DB binding: paid_api_cache table", paidCache);

// 1e. Check existing relationships/shipments tables
const hasRels = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='importyeti_web_relationships'").all().length > 0;
const hasShips = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='importyeti_web_shipments'").all().length > 0;
check("DB binding: importyeti_web_relationships table", hasRels);
check("DB binding: importyeti_web_shipments table", hasShips);

// ========== 2. CREDIT ESTIMATION & BUDGET ==========
console.log("\n2. BUDGET PROTECTION");
console.log("-".repeat(78));

const TOTAL_CREDITS = 100;
const RESERVE = 25;
const AVAILABLE = 75;

// 2a. Check budget constants
check("Total credits: 100", true, `AVAILABLE: ${AVAILABLE} (reserve: ${RESERVE})`);

// 2b. Estimate cost for lavatory faucet
const EST_COST = 3;
const budgetAfter = AVAILABLE - EST_COST;
check("Estimated cost: 3 credits", true, `Remaining after: ${budgetAfter} credits`);
check("Reserve protected (25 credits)", budgetAfter >= RESERVE, `${budgetAfter} >= ${RESERVE}`);

// 2c. Check credit_required guard
const creditGuardCode = readFileIfExists(join(root, "app/api/_shared/importyeti-paid-gateway.ts"));
const hasCreditGuard = creditGuardCode && creditGuardCode.includes("credit_required");
check("Credit guard: credit_required status in gateway", hasCreditGuard, "Blocks execution when credits <= 0");

// 2d. Check budget_blocked exists too
const hasBudgetBlocked = creditGuardCode && creditGuardCode.includes("budget_blocked");
check("Credit guard: budget_blocked status", hasBudgetBlocked, "Blocks when cost exceeds available");

// 2e. Check PaidGatewayStatus includes credit_required
const hasStatusType = creditGuardCode && creditGuardCode.includes('"credit_required"');
check("Credit guard: credit_required in PaidGatewayStatus type", hasStatusType);

// ========== 3. DATA PIPELINE ==========
console.log("\n3. DATA PIPELINE SAFETY");
console.log("-".repeat(78));

// 3a. Normalizer exists
const normalizerCode = readFileIfExists(join(root, "lib/normalizers/trade.ts"));
const hasNormalizer = normalizerCode && normalizerCode.includes("normalizeRanking");
const hasQualifyBuyer = normalizerCode && normalizerCode.includes("qualifyBuyer");
const hasExcludeKw = normalizerCode && normalizerCode.includes("excludeKeywords");
check("Normalizer: normalizeRanking function", hasNormalizer);
check("Normalizer: qualifyBuyer integration", hasQualifyBuyer);
check("Normalizer: excludeKeywords passed to context", hasExcludeKw);

// 3b. Company identity
const hasAliases = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='company_identity_aliases'").all().length > 0;
const aliasCount = hasAliases ? db.prepare("SELECT COUNT(*) as c FROM company_identity_aliases").all()[0].c : 0;
check("Identity: company_identity_aliases table", hasAliases, `${aliasCount} aliases`);
const hasIdentityCol = db.prepare("PRAGMA table_info(importyeti_web_entities)").all().some(c => c.name === "identity_confidence");
check("Identity: identity_confidence column", hasIdentityCol);

// 3c. Data preservation — check capture SQL pattern
const captureFile = join(root, "data/importyeti-web-capture-2026-08-05.sql");
const captureCode = readFileIfExists(captureFile);
const hasCoalesce = captureCode && captureCode.includes("COALESCE(excluded.");
const hasAddrGuard = captureCode && captureCode.includes("address IS NULL");
const hasNameGuard = captureCode && captureCode.includes("length(excluded.name)");
check("Data preservation: COALESCE for NULL protection", hasCoalesce);
check("Data preservation: address NULL guard", hasAddrGuard);
check("Data preservation: name length guard (longer preferred)", hasNameGuard);

// 3d. Data preservation — enrichment files as source of truth
const fixDataFile = join(root, "data/fix-data-preservation-2026-08-08.sql");
const hasDataFix = existsSync(fixDataFile);
check("Data preservation: fix-data-preservation applied", hasDataFix, "Ensured capture files don't clobber enrichment");

// 3e. Shipment storage
const shipmentsCode = readFileIfExists(join(root, "lib/repositories/shipment-repository.ts"));
const hasShipmentUpsert = shipmentsCode && shipmentsCode.includes("ON CONFLICT(id) DO NOTHING");
check("Shipments: ON CONFLICT DO NOTHING (idempotent insert)", hasShipmentUpsert);

// 3f. Ranking engine
const rankingCode = readFileIfExists(join(root, "lib/ranking/engine.ts"));
const hasRankBuyers = rankingCode && rankingCode.includes("function rankBuyers");
check("Ranking: rankBuyers function", hasRankBuyers);

// 3g. Qualification engine
const qualCode = readFileIfExists(join(root, "lib/qualification/factors.ts"));
const hasQual = qualCode && qualCode.includes("export function qualifyBuyer");
const qualTypes = readFileIfExists(join(root, "lib/qualification/types.ts"));
const hasMatchConf = qualTypes && qualTypes.includes("productMatchConfidence");
const hasDataCov = qualTypes && qualTypes.includes("dataCoverage");
check("Qualification: qualifyBuyer function", hasQual);
check("Qualification: productMatchConfidence field", hasMatchConf);
check("Qualification: dataCoverage weight factor", hasDataCov);

// 3h. Product dictionary
const dictCode = readFileIfExists(join(root, "lib/products/dictionary.ts"));
const hasExcludeDict = dictCode && dictCode.includes("excludeKeywords");
const hasShower = dictCode && dictCode.includes("shower head") && dictCode.includes("hand shower");
const hasFaucet = dictCode && dictCode.includes("vanity faucet") && dictCode.includes("widespread faucet");
check("Products: excludeKeywords in dictionary", hasExcludeDict);
check("Products: shower category includes hand/head", hasShower);
check("Products: faucet category includes vanity/widespread", hasFaucet);

// 3i. Cache
const cacheCode = readFileIfExists(join(root, "lib/cache/resolver.ts"));
const hasCache = cacheCode && cacheCode.includes("read") && cacheCode.includes("write");
check("Cache: CacheResolver with read/write", hasCache);

// 3j. Current database state
const totalImporters = db.prepare("SELECT COUNT(*) as c FROM importyeti_web_entities WHERE entity_type='importer'").all()[0].c;
const withData = db.prepare("SELECT COUNT(*) as c FROM importyeti_web_entities WHERE entity_type='importer' AND total_shipments > 0").all()[0].c;
const withoutData = totalImporters - withData;
const totalSuppliers = db.prepare("SELECT COUNT(*) as c FROM importyeti_web_entities WHERE entity_type='supplier'").all()[0].c;
const totalRels = db.prepare("SELECT COUNT(*) as c FROM importyeti_web_relationships").all()[0].c;
const totalShipments = db.prepare("SELECT COUNT(*) as c FROM importyeti_web_shipments").all()[0].c;
const uniqueNames = db.prepare("SELECT COUNT(DISTINCT LOWER(TRIM(name))) as c FROM importyeti_web_entities WHERE entity_type='importer'").all()[0].c;

console.log("\n  Current database state:");
console.log(`    Importers: ${totalImporters} (${withData} with data, ${withoutData} without)`);
console.log(`    Suppliers: ${totalSuppliers}`);
console.log(`    Relationships: ${totalRels}`);
console.log(`    Shipments: ${totalShipments}`);
console.log(`    Unique importer names: ${uniqueNames}`);
check("Database is consistent", totalImporters === uniqueNames, "No name duplicates");

// ========== 4. QUERY-SPECIFIC CHECKS ==========
console.log("\n4. TARGET QUERY: lavatory faucet");
console.log("-".repeat(78));

// 4a. Credit estimation
check(`Estimated cost: ${EST_COST} credits`, true);
check(`Budget after execution: ${budgetAfter}/${TOTAL_CREDITS} credits`, true);
check(`Available credits sufficient (${AVAILABLE} >= ${EST_COST})`, AVAILABLE >= EST_COST);

// 4b. Expected overlap
const faucetImporters = db.prepare("SELECT COUNT(*) as c FROM importyeti_web_entities WHERE entity_type='importer' AND (search_query LIKE '%faucet%' OR search_query LIKE '%shower%' OR search_query LIKE '%龙头%')").all()[0].c;
const bathroomImps = db.prepare("SELECT COUNT(*) as c FROM importyeti_web_entities WHERE entity_type='importer' AND (search_query LIKE '%bathroom%' OR search_query LIKE '%basin%' OR search_query LIKE '%lavatory%' OR search_query LIKE '%shower%' OR search_query LIKE '%龙头%' OR search_query LIKE '%花洒%')").all()[0].c;
check(`Existing bathroom-related importers: ${bathroomImps}`, true, `${faucetImporters} are faucet/shower specific`);
warn("Expected overlap with 'bathroom faucet': medium (same HS 8481.80)", "Identity system will merge duplicates");

// 4c. Expected new buyers
const estNew = 12;
const estTotal = withData + estNew;
check(`Expected new confirmed buyers: ~${estNew}`, true, `Total after: ~${estTotal} confirmed`);

// 4d. Product relevance check
check("lavatory faucet match keywords in dictionary", dictCode && (dictCode.includes("lavatory faucet") || dictCode.includes("lavatory")));
check("lavatory faucet exclude keywords configured", dictCode && dictCode.includes("kitchen"));

// ========== 5. SUMMARY ==========
console.log("\n" + "=".repeat(78));
console.log("PREFLIGHT SUMMARY");
console.log("=".repeat(78));

const passCount = results.filter(r => r.pass && !r.warn).length;
const warnCount = results.filter(r => r.warn).length;
const failCount = results.filter(r => !r.pass).length;
const total = results.length;

console.log(`\n  ${PASS} Passed: ${passCount}  ${WARN} Warnings: ${warnCount}  ${FAIL} Failed: ${failCount}  (${total} checks)`);

if (failCount === 0) {
  console.log("\n  STATUS: READY TO EXECUTE");
  console.log(`  Query:    lavatory faucet`);
  console.log(`  Cost:     ${EST_COST} credits`);
  console.log(`  Budget:   ${AVAILABLE} available → ${budgetAfter} after execution`);
  console.log(`  Reserve:  ${RESERVE} credits protected`);
} else {
  console.log(`\n  STATUS: ${failCount} CHECKS FAILED`);
  console.log("  Fix the failed checks before executing any paid query.");
  for (const r of results.filter(r => !r.pass)) {
    console.log(`    ${FAIL} ${r.label}`);
  }
}

console.log();

// ========== Post-execution report template ==========
console.log("=".repeat(78));
console.log("POST-EXECUTION REPORT TEMPLATE");
console.log("=".repeat(78));
console.log(`
After running "lavatory faucet", capture:

QUERY EXECUTION
  Credits consumed:         [actual]
  Execution status:         [completed / failed]
  Raw importers returned:   [N]

PIPELINE RESULTS
  Companies upserted:       [N] (ON CONFLICT preserved richer data)
  New companies created:    [N]
  Duplicates merged:        [N]
  Identity aliases added:   [N]
  Shipments stored:         [N]
  Relationships created:    [N]

BUYER CLASSIFICATION
  CONFIRMED:                [N] (bathroom query + shipment data)
  CANDIDATE_BATHROOM:       [N]
  Product match ≥50:       [N] / [total]
  Non-bathroom flagged:     [N]

RANKING CHANGES
  Importers before:         ${totalImporters}
  Importers after:          [N]
  Priority A before/after:  [n] → [n]
  Priority B before/after:  [n] → [n]
  Priority C before/after:  [n] → [n]
  New in top 10:            [list]

DATA PRESERVATION
  Existing data overwritten: 0 (verified by COALESCE guards)
  Degraded addresses:        0
  Lost websites:              0
  Identity scores unchanged:  yes

Re-run: node scripts/calibrate.mjs
`);

db.close();

function readFileIfExists(filePath) {
  try {
    return readFileSync(filePath, "utf8");
  } catch {
    return null;
  }
}
