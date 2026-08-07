import assert from "node:assert/strict";
import test from "node:test";
import { resolveProduct } from "../lib/products/resolver.ts";
import { rankBuyers } from "../lib/ranking/engine.ts";
import { validateQuery } from "../lib/query/validator.ts";
import { normalizeQuery } from "../lib/query/hash.ts";
import { QueryEngine } from "../lib/query/engine.ts";
import { CacheResolver } from "../lib/cache/resolver.ts";
import { MemoryCache, FixedBudget } from "../app/api/_shared/query-engine-production.ts";
import { importYetiWebCapability, importYetiCapability } from "../lib/providers/mock/capabilities.ts";
import type { SupplierDiscovery } from "../lib/query/types.ts";

function makeView(count: number, requestedMonths: string[] = ["2026-07"]): SupplierDiscovery {
  const importers = Array.from({ length: count }, (_, index) => ({
    id: `importer-${index}`,
    name: `Importer ${index}`,
    selected_month_shipments: count - index,
    supplier_count: (index % 5) + 1,
    selected_month_weight_kg: (count - index) * 1000,
    selected_month_containers: (index % 7) + 1,
  }));
  return {
    available: true,
    dataset: "importyeti_free_web",
    market: "US",
    flow: "import",
    product: "faucet",
    hsCode: "848180",
    requestedMonths,
    latestAvailableMonth: "2026-07",
    importers,
    suppliers: [],
    storedShipmentCoverage: [],
  };
}

test("buyer_ranking query validation accepts metrics and rejects unknown ones", () => {
  const valid = validateQuery({
    intent: "buyer_ranking",
    subject: "faucet",
    market: "US",
    period: "2026-07",
    ranking: { metric: "shipment_count", limit: 50 },
  });
  assert.equal(valid.ok, true);
  for (const metric of ["shipment_count", "import_frequency", "supplier_count", "weight", "estimated_volume"]) {
    assert.equal(validateQuery({ intent: "buyer_ranking", subject: "faucet", market: "US", period: "2026-07", ranking: { metric, limit: 50 } }).ok, true, metric);
  }
  const invalid = validateQuery({ intent: "buyer_ranking", subject: "faucet", market: "US", period: "2026-07", ranking: { metric: "revenue", limit: 50 } });
  assert.equal(invalid.ok, false);
  assert.ok(invalid.errors.some(error => error.includes("metric")));
});

test("product dictionary resolves aliases to canonical categories", () => {
  assert.equal(resolveProduct("basin faucet")?.id, "faucet");
  assert.equal(resolveProduct("Basin  Faucet")?.id, "faucet");
  assert.equal(resolveProduct("sink faucet")?.id, "faucet");
  assert.equal(resolveProduct("rain shower")?.id, "shower");
  assert.equal(resolveProduct("shower valve")?.id, "shower");
  assert.equal(resolveProduct("水龙头")?.id, "faucet");
  assert.equal(resolveProduct("花洒")?.id, "shower");
  assert.equal(resolveProduct("龙头及阀类")?.id, "faucet");
  assert.equal(resolveProduct("not-a-product")?.id, undefined);
  assert.equal(resolveProduct("faucet")?.defaultHsCode, "8481.80");
  assert.equal(resolveProduct("shower")?.defaultHsCode, "3922.10");
});

test("ranking calculation is deterministic and ties are broken consistently", () => {
  const view = makeView(10);
  const options = { limit: 50, metric: "shipment_count" as const };
  const first = rankBuyers(view, options);
  const second = rankBuyers(view, options);
  assert.deepEqual(first, second);
  assert.equal(first.ranked[0].rank, 1);
  assert.equal(first.ranked[0].metric_value, 10);
  assert.equal(first.ranked[1].metric_value, 9);
  const tied = makeView(3);
  tied.importers = tied.importers.map(row => ({ ...row, selected_month_shipments: 5 }));
  const ranked = rankBuyers(tied, { limit: 3, metric: "shipment_count" });
  const names = ranked.ranked.map(row => row.name);
  assert.deepEqual(names, [...names].sort());
});

test("ranking metrics compute correct values", () => {
  const view = makeView(3);
  const byWeight = rankBuyers(view, { limit: 50, metric: "weight" });
  assert.equal(byWeight.ranked[0].metric_value, 3000);
  const byFrequency = rankBuyers({ ...view, requestedMonths: ["2026-07", "2026-08"] }, { limit: 50, metric: "import_frequency" });
  assert.equal(byFrequency.ranked[0].metric_value, 1.5);
  const bySuppliers = rankBuyers(view, { limit: 50, metric: "supplier_count" });
  assert.equal(bySuppliers.ranked[0].metric_value, 3);
});

test("Top20 request reuses the Top50 cached ranking without calling the provider again", async () => {
  const cache = new MemoryCache();
  let calls = 0;
  const provider = {
    capability: importYetiWebCapability,
    fetch: async () => {
      calls += 1;
      return makeView(50);
    },
  };
  const resolver = new CacheResolver({ cache, providers: [provider], resolveProvider: () => provider });
  const engine = new QueryEngine({
    capabilities: [importYetiWebCapability, importYetiCapability],
    registry: { list: () => [], route: () => provider },
    resolver,
    budget: new FixedBudget(0),
    logger: { log: async () => {} },
  });
  const top50 = await engine.execute({ intent: "buyer_ranking", subject: "faucet", market: "US", period: "2026-07", ranking: { metric: "shipment_count", limit: 50 } });
  assert.equal(top50.status, "completed");
  assert.equal(top50.cached, false);
  assert.equal(calls, 1);
  assert.equal(top50.data?.kind, "ranking");
  const top50Ranking = top50.data?.kind === "ranking" ? top50.data.ranking : null;
  assert.equal(top50Ranking?.topLimit, 50);
  assert.equal(top50Ranking?.topCount, 50);

  const top20 = await engine.execute({ intent: "buyer_ranking", subject: "faucet", market: "US", period: "2026-07", ranking: { metric: "shipment_count", limit: 20 } });
  assert.equal(top20.status, "cache_hit");
  assert.equal(top20.cached, true);
  assert.equal(calls, 1);
  const top20Ranking = top20.data?.kind === "ranking" ? top20.data.ranking : null;
  assert.equal(top20Ranking?.topLimit, 20);
  assert.equal(top20Ranking?.topCount, 20);
  assert.equal(top20Ranking?.totalCount, 50);
  assert.equal(top20Ranking?.ranked[0].rank, 1);
  assert.equal(top20Ranking?.ranked[0].metric_value, 50);
});

test("normalizeQuery canonicalizes ranking limit to 50 so Top20 and Top50 share a cache key", () => {
  const twenty = normalizeQuery({ intent: "buyer_ranking", subject: "faucet", market: "US", period: "2026-07", ranking: { metric: "shipment_count", limit: 20 } });
  const fifty = normalizeQuery({ intent: "buyer_ranking", subject: "faucet", market: "US", period: "2026-07", ranking: { metric: "shipment_count", limit: 50 } });
  assert.deepEqual(twenty.ranking, fifty.ranking);
  assert.equal(twenty.ranking?.limit, 50);
});

test("Query Engine still controls provider access for ranking queries", async () => {
  const engine = new QueryEngine({
    capabilities: [importYetiWebCapability],
    registry: { list: () => [], route: () => null },
    resolver: {
      resolve: async () => {
        throw new Error("must not be called");
      },
    },
    budget: new FixedBudget(0),
    logger: { log: async () => {} },
  });
  const unserved = await engine.execute({ intent: "buyer_ranking", subject: "faucet", market: "US", period: "2026-07", ranking: { limit: 20 } });
  assert.equal(unserved.status, "failed");
  assert.equal(unserved.reason, "Planned provider is not registered");

  const paidCalls = { count: 0 };
  const paidProvider = {
    capability: importYetiCapability,
    fetch: async () => {
      paidCalls.count += 1;
      return { companies: [] };
    },
  };
  const paidEngine = new QueryEngine({
    capabilities: [importYetiCapability],
    registry: { list: () => [], route: () => paidProvider },
    resolver: new CacheResolver({ cache: new MemoryCache(), providers: [paidProvider], resolveProvider: () => paidProvider }),
    budget: new FixedBudget(0),
    logger: { log: async () => {} },
  });
  const blocked = await paidEngine.execute({ intent: "buyer_ranking", subject: "faucet", market: "US", period: "2026-07", ranking: { metric: "weight", limit: 50 } });
  assert.equal(blocked.status, "awaiting_approval");
  assert.equal(blocked.data, undefined);
  assert.equal(paidCalls.count, 0);
});
