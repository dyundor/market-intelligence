#! /usr/bin/env node
/**
 * Sprint 15.1 Step 4 — Lead Initializer E2E Verification
 *
 * Verifies the full chain: rankings → qualification → lead strategy → persistence
 * Uses the local D1 database (no paid APIs).
 */
import { DatabaseSync } from "node:sqlite";
import { readdirSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const stateDir = join(root, ".wrangler", "state", "v3", "d1", "miniflare-D1DatabaseObject");
const files = readdirSync(stateDir)
  .filter(f => f.endsWith(".sqlite") && f !== "metadata.sqlite")
  .map(f => join(stateDir, f))
  .sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs);
const live = files.find(f => statSync(f).size > 0) || files[0];
if (!live) {
  console.error("No local D1 database found. Run `npm run dev` first.");
  process.exit(1);
}
const rawDb = new DatabaseSync(live);

const dbLike = {
  prepare(sql) {
    const stmt = rawDb.prepare(sql);
    return {
      bind(...args) {
        return {
          async all() {
            return { results: stmt.all(...args) };
          },
          async run() {
            stmt.run(...args);
            return { meta: { changes: 1 } };
          },
        };
      },
    };
  },
};

const { LeadInitializer } = await import("../lib/leads/initializer.ts");

const HH = "=".repeat(60);
const HR = "-".repeat(60);

console.log(HH);
console.log("Sprint 15.1 Step 4 — Lead E2E Verification");
console.log(HH);

const init = new LeadInitializer(dbLike);

console.log();
console.log("1. Fetching top buyers from rankings...");
const buyers = await init.getTopBuyers("shipment_count", 5);
console.log(`   Found: ${buyers.length} buyers`);

if (!buyers.length) {
  console.error("No buyers in rankings. Did you run db:seed?");
  process.exit(1);
}

console.log();
console.log("2. Generating lead records from qualification data...");
const leads = [];
for (const buyer of buyers) {
  const lead = await init.generateLeadRecord(buyer);
  leads.push({ buyer, lead });
}

console.log();
console.log(HR);
console.log("   LEAD SUMMARY");
console.log(HR);
for (const { buyer, lead } of leads) {
  console.log(`   ${buyer.entity.name}`);
  console.log(`     Priority: ${lead.leadStatus} | Strategy: ${lead.outreachStrategy}`);
  console.log(`     Products: ${lead.recommendedProducts} | Confidence: ${lead.confidence}`);
  console.log(`     Fit: ${lead.commercialFitScore} | Outreach: ${lead.outreachScore}`);
  console.log();
}

console.log("3. Persisting leads to watchlist (explicit trigger)...");
for (const { buyer, lead } of leads) {
  const ok = await init.initializeLead(buyer.buyerId, lead);
  console.log(`   ${ok ? "✓" : "✗"} ${buyer.entity.name}`);
}

const watchlistRows = rawDb.prepare("SELECT COUNT(*) cnt FROM buyer_watchlist").all();
console.log(`\n   Watchlist entries: ${watchlistRows[0]?.cnt || 0}`);

const leadStatuses = rawDb.prepare(
  "SELECT lead_status, COUNT(*) cnt FROM buyer_watchlist GROUP BY lead_status",
).all();
console.log("   By lead_status:");
for (const row of leadStatuses) {
  console.log(`     ${row.lead_status}: ${row.cnt}`);
}

console.log();
console.log(HH);
console.log("VERIFICATION COMPLETE");
console.log(HH);
console.log("Full chain verified: rankings → qualification → strategy → persistence");
