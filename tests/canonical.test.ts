import assert from "node:assert/strict";
import test from "node:test";
import { companyFromRow, companyIdentityKey, normalizeCompanyName } from "../lib/entities/company.ts";
import { supplierFromRow } from "../lib/entities/supplier.ts";
import { shipmentFromRow, type Shipment } from "../lib/entities/shipment.ts";
import { rankBuyers, rankShipments } from "../lib/ranking/engine.ts";
import { persistMonthlyRankings } from "../lib/ranking/persist.ts";
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

class MockDb {
  calls: Array<{ sql: string; args: unknown[] }> = [];

  prepare(sql: string) {
    return {
      bind: (...args: unknown[]) => ({
        run: async () => {
          this.calls.push({ sql, args });
        },
      }),
    };
  }
}

test("provider data normalizes into canonical company and shipment entities", () => {
  const importerRow = {
    id: "e1",
    name: "Kohler Co.",
    country: "United States",
    country_code: "US",
    website: "https://kohler.com",
    source_channel: "importyeti_free_web",
    source_url: "https://example.org/e1",
  };
  const company = companyFromRow(importerRow);
  assert.equal(company.id, "e1");
  assert.equal(company.name, "Kohler Co.");
  assert.equal(company.identityKey, "kohler");
  assert.equal(company.entityType, "importer");
  assert.equal(company.countryCode, "US");
  assert.equal(company.website, "https://kohler.com");
  const supplier = supplierFromRow({ ...importerRow, id: "s1" });
  assert.equal(supplier.entityType, "supplier");

  const shipmentRow = {
    id: "sh1",
    supplier_id: "s1",
    importer_id: "e1",
    importer_name: "Kohler Co.",
    shipment_date: "2026-07-15",
    weight_kg: 12000,
    container_count: 2,
    quantity: 100,
    estimated_freight_usd: "3400",
    source_channel: "importyeti_free_web",
  };
  const shipment = shipmentFromRow(shipmentRow);
  assert.equal(shipment.id, "sh1");
  assert.equal(shipment.importerName, "Kohler Co.");
  assert.equal(shipment.shipmentDate, "2026-07-15");
  assert.equal(shipment.weightKg, 12000);
  assert.equal(shipment.containerCount, 2);
  assert.equal(shipment.quantity, 100);
  assert.equal(shipment.freightUsd, 3400);
  assert.equal(shipment.sourceChannel, "importyeti_free_web");
});

test("company identity mapping merges provider variants of the same company", () => {
  const importYeti = "Kohler Co.";
  const comtrade = "KOHLER";
  assert.equal(companyIdentityKey(importYeti), companyIdentityKey(comtrade));
  assert.equal(companyIdentityKey("Kohler Co., Inc."), companyIdentityKey(comtrade));
  assert.equal(companyIdentityKey("Kohler Company"), companyIdentityKey(comtrade));
  assert.equal(normalizeCompanyName("Kohler Co."), "kohler");
  assert.notEqual(companyIdentityKey("Kohler"), companyIdentityKey("Delta Faucet"));
});

function shipmentsFor(buyerId: string, buyerName: string, supplierIds: string[], count: number, weightKg: number): Shipment[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `${buyerId}-${index}`,
    supplierId: supplierIds[index % supplierIds.length],
    importerId: buyerId,
    importerName: buyerName,
    shipmentDate: index % 2 === 0 ? "2026-07-10" : "2026-08-10",
    weightKg,
    containerCount: 1,
    quantity: 10,
    freightUsd: 1000,
    hsCodes: "848180",
    productDescriptions: "faucet",
    sourceChannel: "importyeti_free_web",
    sourceUrl: "",
  }));
}

test("ranking calculation aggregates normalized shipment records deterministically", () => {
  const shipments = [
    ...shipmentsFor("a", "A Plumbing", ["s1", "s2"], 5, 1000),
    ...shipmentsFor("b", "B Supply", ["s3"], 3, 500),
  ];
  const context = {
    market: "US",
    flow: "import",
    product: "faucet",
    dataset: "importyeti_free_web",
    hsCode: "848180",
    requestedMonths: ["2026-07", "2026-08"],
    metric: "shipment_count" as const,
    limit: 10,
  };
  const ranking = rankShipments(shipments, context);
  assert.equal(ranking.ranked[0].name, "A Plumbing");
  assert.equal(ranking.ranked[0].metric_value, 5);
  assert.equal(ranking.ranked[1].metric_value, 3);
  assert.equal(ranking.totalCount, 2);
  assert.equal(ranking.productCategory, "faucet");
  const first = rankShipments(shipments, context);
  assert.deepEqual(first, ranking);

  const bySuppliers = rankShipments(shipments, { ...context, metric: "supplier_count" });
  assert.equal(bySuppliers.ranked[0].metric_value, 2);
  const byWeight = rankShipments(shipments, { ...context, metric: "weight" });
  assert.equal(byWeight.ranked[0].metric_value, 5000);
  const byFrequency = rankShipments(shipments, { ...context, metric: "import_frequency" });
  assert.equal(byFrequency.ranked[0].metric_value, 2.5);
});

test("ranking persistence stores calculated results without touching raw data", async () => {
  const db = new MockDb();
  const shipments = [...shipmentsFor("a", "A Plumbing", ["s1", "s2"], 5, 1000), ...shipmentsFor("b", "B Supply", ["s3"], 3, 500)];
  const ranking = rankShipments(shipments, {
    market: "US",
    flow: "import",
    product: "faucet",
    dataset: "importyeti_free_web",
    hsCode: "848180",
    requestedMonths: ["2026-07"],
    metric: "shipment_count",
    limit: 10,
  });
  const written = await persistMonthlyRankings({ db, ranking });
  assert.equal(written, 2);
  assert.equal(db.calls.length, 2);
  const first = db.calls[0].args;
  assert.equal(first[0], "US:faucet:2026-07:shipment_count:a");
  assert.equal(first[1], "US");
  assert.equal(first[2], "faucet");
  assert.equal(first[3], 2026);
  assert.equal(first[4], 7);
  assert.equal(first[5], "a");
  assert.equal(first[6], 1);
  assert.equal(first[7], "shipment_count");
  assert.equal(first[8], 5);
  assert.equal(first[9], "importyeti_free_web");
  assert.equal(db.calls[1].args[6], 2);
});

test("query input accepts product alias and period {from,to} and normalizes to the same query", () => {
  const ranged = normalizeQuery({ intent: "buyer_ranking", product: "faucet", market: "us", period: { from: "2026-07", to: "2026-07" }, ranking: { metric: "shipment_count", limit: 50 } });
  const plain = normalizeQuery({ intent: "buyer_ranking", subject: "faucet", market: "US", period: "2026-07", months: ["2026-07"], ranking: { metric: "shipment_count", limit: 50 } });
  assert.deepEqual(ranged, plain);
  assert.deepEqual(ranged.months, ["2026-07"]);
  const multi = normalizeQuery({ intent: "buyer_ranking", product: "faucet", market: "US", period: { from: "2026-06", to: "2026-08" } });
  assert.deepEqual(multi.months, ["2026-06", "2026-07", "2026-08"]);
  assert.equal(multi.period, "2026-08");
  assert.equal(validateQuery({ intent: "buyer_ranking", product: "faucet", market: "US", period: { from: "2026-07", to: "2026-07" }, ranking: { metric: "shipment_count", limit: 50 } }).ok, true);
  assert.equal(validateQuery({ intent: "buyer_ranking", product: "faucet", market: "US", period: { from: "2026-08", to: "2026-07" } }).ok, false);
  assert.equal(validateQuery({ intent: "buyer_ranking", product: "faucet", market: "US", period: { from: "2026-07", to: "bad" } }).ok, false);
});

test("Query Engine buyer_ranking flow works end to end and Top20 reuses the Top50 cache", async () => {
  const cache = new MemoryCache();
  let calls = 0;
  const provider = {
    capability: importYetiWebCapability,
    fetch: async (query: { months?: string[] }) => {
      calls += 1;
      return makeView(50, query.months?.length ? query.months : ["2026-07"]);
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

  const top50 = await engine.execute({
    intent: "buyer_ranking",
    product: "faucet",
    market: "US",
    period: { from: "2026-07", to: "2026-07" },
    ranking: { metric: "shipment_count", limit: 50 },
  });
  assert.equal(top50.status, "completed");
  assert.equal(top50.cached, false);
  assert.equal(calls, 1);
  assert.equal(top50.data?.kind, "ranking");
  const top50Ranking = top50.data?.kind === "ranking" ? top50.data.ranking : null;
  assert.deepEqual(top50Ranking?.requestedMonths, ["2026-07"]);
  assert.equal(top50Ranking?.topCount, 50);

  const top20 = await engine.execute({
    intent: "buyer_ranking",
    subject: "faucet",
    market: "US",
    period: "2026-07",
    months: ["2026-07"],
    ranking: { metric: "shipment_count", limit: 20 },
  });
  assert.equal(top20.status, "cache_hit");
  assert.equal(top20.cached, true);
  assert.equal(calls, 1);
  const top20Ranking = top20.data?.kind === "ranking" ? top20.data.ranking : null;
  assert.equal(top20Ranking?.topLimit, 20);
  assert.equal(top20Ranking?.topCount, 20);
  assert.equal(top20Ranking?.totalCount, 50);
  assert.equal(top20Ranking?.ranked[0].metric_value, 50);
});

test("rankBuyers keeps provider row passthrough with canonical identity fields", () => {
  const view = makeView(3);
  const ranking = rankBuyers(view, { limit: 10, metric: "shipment_count" });
  assert.equal(ranking.ranked[0].id, "importer-0");
  assert.equal(ranking.ranked[0].name, "Importer 0");
  assert.equal(ranking.ranked[0].rank, 1);
  assert.equal(ranking.ranked[0].metric_value, 3);
  assert.equal(ranking.ranked[0].supplier_count, 1);
});
