import assert from "node:assert/strict";
import test from "node:test";
import { QueryEngine } from "../lib/query/engine.ts";
import { planQuery } from "../lib/query/planner.ts";
import { validateQuery } from "../lib/query/validator.ts";
import { normalizeQuery, queryHash } from "../lib/query/hash.ts";
import { comtradeCapability, importYetiCapability } from "../lib/providers/mock/capabilities.ts";
import { CacheResolver } from "../lib/cache/resolver.ts";
import { MemoryCache, FixedBudget } from "../app/api/_shared/query-engine-production.ts";

const CAPABILITIES = [comtradeCapability, importYetiCapability];

function memoryEngine(overrides: { budgetApproval?: number } = {}) {
  return new QueryEngine({
    capabilities: CAPABILITIES,
    registry: { list: () => [], route: () => null },
    resolver: {
      resolve: async () => ({ source: "provider" as const, cacheHit: false, raw: { records: [] } }),
    },
    budget: new FixedBudget(overrides.budgetApproval ?? 0),
    logger: { log: async () => {} },
  });
}

test("normalizes and hashes queries consistently regardless of case and whitespace", async () => {
  const left = normalizeQuery({ intent: "buyer_ranking", subject: " Faucet ", market: "us", period: "2026-07", ranking: { limit: 50 } });
  const right = normalizeQuery({ intent: "buyer_ranking", subject: "faucet", market: "US", period: "2026-07", ranking: { limit: 50 } });
  assert.deepEqual(left, right);
  assert.equal(await queryHash(left), await queryHash(right));
});

test("validates required fields and ranking bounds", () => {
  assert.equal(validateQuery({ intent: "buyer_ranking", subject: "faucet", market: "US", period: "2026-07" }).ok, true);
  const bad = validateQuery({ intent: "nope", subject: "", market: "USA", period: "2026/07", ranking: { limit: 999 } });
  assert.equal(bad.ok, false);
  assert.ok(bad.errors.length >= 4);
});

test("routes trade_trend to Comtrade and ranking to ImportYeti", () => {
  const tradePlan = planQuery({ intent: "trade_trend", subject: "faucet", market: "US", period: "2026-07" }, CAPABILITIES);
  assert.equal(tradePlan.requiredProviders[0].providerId, "comtrade");
  assert.equal(tradePlan.requiredProviders[0].kind, "free");
  const rankingPlan = planQuery({ intent: "buyer_ranking", subject: "faucet", market: "US", period: "2026-07", ranking: { limit: 50 } }, CAPABILITIES);
  assert.equal(rankingPlan.requiredProviders[0].providerId, "importyeti");
  assert.equal(rankingPlan.requiredProviders[0].kind, "paid");
  assert.ok(tradePlan.rejectedProviders.some(item => item.providerId === "importyeti"));
});

test("requires approval for paid queries above budget and reports credits", async () => {
  const engine = new QueryEngine({
    capabilities: CAPABILITIES,
    registry: {
      list: () => [],
      route: () => ({ capability: importYetiCapability, fetch: async () => ({ companies: [{ id: "1", name: "A", country: "US", website: null, shipments: 1 }] }) }),
    },
    resolver: {
      resolve: async () => ({ source: "provider" as const, cacheHit: false, raw: { companies: [{ id: "1", name: "A", country: "US", website: null, shipments: 1 }] } }),
    },
    budget: new FixedBudget(0),
    logger: { log: async () => {} },
  });
  const result = await engine.execute({ intent: "buyer_ranking", subject: "faucet", market: "US", period: "2026-07", ranking: { limit: 50 } });
  assert.equal(result.status, "awaiting_approval");
  assert.ok(Math.abs((result.credits || 0) - 2.4) < 1e-9);
});

test("cached results bypass the provider entirely and cost zero", async () => {
  const cache = new MemoryCache();
  let fetches = 0;
  const provider = {
    capability: importYetiCapability,
    fetch: async () => { fetches += 1; return { companies: [{ id: "1", name: "A", country: "US", website: null, shipments: 1 }] }; },
  };
  const resolver = new CacheResolver({ cache, providers: [provider], resolveProvider: () => provider });
  const engine = new QueryEngine({
    capabilities: CAPABILITIES,
    registry: { list: () => [], route: () => provider },
    resolver,
    budget: new FixedBudget(100),
    logger: { log: async () => {} },
  });
  const query = { intent: "buyer_ranking" as const, subject: "faucet", market: "US", period: "2026-07" };
  const hash = await queryHash(query);
  await cache.write(hash, { companies: [{ id: "1", name: "A", country: "US", website: null, shipments: 1 }] });
  const result = await engine.execute(query);
  assert.equal(result.status, "cache_hit");
  assert.equal(fetches, 0);
});

test("rejects queries no provider can serve and invalid intents", async () => {
  const engine = memoryEngine();
  const result = await engine.execute({ intent: "buyer_ranking", subject: "faucet", market: "US", period: "2026-07" });
  assert.equal(result.status, "failed");
  const invalid = await engine.execute({ intent: "unknown", subject: "faucet", market: "US", period: "2026-07" });
  assert.equal(invalid.status, "failed");
  assert.ok(invalid.reason?.includes("intent"));
});
