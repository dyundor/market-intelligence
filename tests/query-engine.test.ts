import assert from "node:assert/strict";
import test from "node:test";
import { QueryEngine } from "../lib/query/engine.ts";
import { planQuery } from "../lib/query/planner.ts";
import { validateQuery } from "../lib/query/validator.ts";
import { normalizeQuery, queryHash } from "../lib/query/hash.ts";
import { comtradeCapability, importYetiCapability, importYetiWebCapability } from "../lib/providers/mock/capabilities.ts";
import { CacheResolver } from "../lib/cache/resolver.ts";
import { MemoryCache, FixedBudget } from "../app/api/_shared/query-engine-production.ts";

const CAPABILITIES = [comtradeCapability, importYetiWebCapability, importYetiCapability];

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

test("planner routes trade_trend to free Comtrade and prefers free over paid for ranking", () => {
  const tradePlan = planQuery({ intent: "trade_trend", subject: "faucet", market: "US", period: "2026-07" }, CAPABILITIES);
  assert.equal(tradePlan.requiredProviders[0].providerId, "comtrade");
  assert.equal(tradePlan.requiredProviders[0].kind, "free");
  const rankingPlan = planQuery({ intent: "buyer_ranking", subject: "faucet", market: "US", period: "2026-07", ranking: { limit: 50 } }, CAPABILITIES);
  assert.equal(rankingPlan.requiredProviders[0].providerId, "importyeti_web");
  assert.equal(rankingPlan.requiredProviders[0].kind, "free");
  assert.ok(tradePlan.rejectedProviders.some(item => item.providerId === "importyeti"));
});

test("integration: cache hit does not call the provider", async () => {
  const cache = new MemoryCache();
  const view = { companies: [{ id: "1", name: "A", country: "US", website: null, shipments: 1 }] };
  const provider = {
    capability: importYetiCapability,
    fetch: async () => {
      throw new Error("provider must not be called");
    },
  };
  const resolver = new CacheResolver({ cache, providers: [provider], resolveProvider: () => provider });
  const query = { intent: "buyer_ranking" as const, subject: "faucet", market: "US", period: "2026-07" };
  await cache.write(await queryHash(query), view);
  const engine = new QueryEngine({
    capabilities: [importYetiCapability],
    registry: { list: () => [], route: () => provider },
    resolver,
    budget: new FixedBudget(100),
    logger: { log: async () => {} },
  });
  const result = await engine.execute(query);
  assert.equal(result.status, "cache_hit");
  assert.equal(result.cached, true);
  assert.equal(result.source[0], "importyeti");
  assert.equal(result.queryId.length, 64);
});

test("integration: cache miss calls the provider and writes through", async () => {
  const cache = new MemoryCache();
  let calls = 0;
  const provider = {
    capability: importYetiCapability,
    fetch: async () => { calls += 1; return { companies: [{ id: "1", name: "A", country: "US", website: null, shipments: 1 }] }; },
  };
  const resolver = new CacheResolver({ cache, providers: [provider], resolveProvider: () => provider });
  const engine = new QueryEngine({
    capabilities: [importYetiCapability],
    registry: { list: () => [], route: () => provider },
    resolver,
    budget: new FixedBudget(100),
    logger: { log: async () => {} },
  });
  const query = { intent: "buyer_ranking" as const, subject: "faucet", market: "US", period: "2026-07" };
  const first = await engine.execute(query);
  assert.equal(first.status, "completed");
  assert.equal(first.cached, false);
  assert.equal(calls, 1);
  const second = await engine.execute(query);
  assert.equal(second.status, "cache_hit");
  assert.equal(calls, 1);
});

test("integration: paid provider without approval never executes", async () => {
  let calls = 0;
  const provider = {
    capability: importYetiCapability,
    fetch: async () => { calls += 1; return { companies: [] }; },
  };
  const resolver = new CacheResolver({ cache: new MemoryCache(), providers: [provider], resolveProvider: () => provider });
  const engine = new QueryEngine({
    capabilities: [importYetiCapability],
    registry: { list: () => [], route: () => provider },
    resolver,
    budget: new FixedBudget(0),
    logger: { log: async () => {} },
  });
  const result = await engine.execute({ intent: "buyer_ranking", subject: "faucet", market: "US", period: "2026-07", ranking: { limit: 50 } });
  assert.equal(result.status, "awaiting_approval");
  assert.equal(result.data, undefined);
  assert.ok(Math.abs((result.cost.estimated || 0) - 2.4) < 1e-9);
  assert.equal(calls, 0);
});

test("rejects queries no provider can serve and invalid intents", async () => {
  const engine = new QueryEngine({
    capabilities: CAPABILITIES,
    registry: { list: () => [], route: () => null },
    resolver: {
      resolve: async () => ({ source: "provider" as const, cacheHit: false, raw: { records: [] } }),
    },
    budget: new FixedBudget(0),
    logger: { log: async () => {} },
  });
  const invalid = await engine.execute({ intent: "unknown", subject: "faucet", market: "US", period: "2026-07" });
  assert.equal(invalid.status, "failed");
  assert.ok(invalid.reason?.includes("intent"));
  const result = await engine.execute({ intent: "trade_trend", subject: "faucet", market: "AE", period: "2026-07" });
  assert.equal(result.status, "failed");
});
