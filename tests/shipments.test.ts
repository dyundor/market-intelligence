import assert from "node:assert/strict";
import test from "node:test";
import { classifySalesProducts, rankHotProducts } from "../lib/products/hot-products.ts";
import { readFileSync } from "node:fs";
import type { Shipment } from "../lib/entities/shipment.ts";
import { shipmentFromRow, enrichShipmentRow } from "../lib/entities/shipment.ts";
import { normalizeShipments, normalizeShipmentRanking } from "../lib/normalizers/shipments.ts";
import { ShipmentRepository } from "../lib/repositories/shipment-repository.ts";
import { QueryEngine } from "../lib/query/engine.ts";
import { CacheResolver } from "../lib/cache/resolver.ts";
import { MemoryCache, FixedBudget } from "../app/api/_shared/query-engine-production.ts";
import { shipmentDataCapability } from "../lib/providers/mock/capabilities.ts";
import { ShipmentRankingProvider } from "../lib/providers/shipments/provider.ts";
import { calculateHsEvidence, parseHsCodes } from "../lib/trade/hs-evidence.ts";

class MockDb {
  calls: Array<{ sql: string; args: unknown[] }> = [];
  private readonly results: Array<Record<string, unknown>>;

  constructor(results: Array<Record<string, unknown>> = []) {
    this.results = results;
  }

  prepare(sql: string) {
    return {
      bind: (...args: unknown[]) => ({
        all: async () => {
          this.calls.push({ sql, args });
          return { results: this.results };
        },
        run: async () => {
          this.calls.push({ sql, args });
        },
      }),
    };
  }
}

const RAW_ROWS: Array<Record<string, unknown>> = [
  { id: "sh-1", house_bol: "HB-1", supplier_id: "sp-a", importer_id: "buy-1", importer_name: "A Plumbing", shipment_date: "2026-07-10", weight_kg: "12000", quantity: "100", container_count: "2", product_description: "BATHROOM FAUCET PARTS", estimated_freight_usd: "3400", source_channel: "importyeti_free_web", source_url: "https://example.org/sh-1" },
  { id: "sh-2", house_bol: "HB-2", supplier_id: "sp-a", importer_id: "buy-1", importer_name: "A Plumbing", shipment_date: "2026-07-11", weight_kg: "5000", quantity: "40", container_count: "1", product_description: "RAIN SHOWER SYSTEM", estimated_freight_usd: "1200", source_channel: "importyeti_free_web", source_url: "https://example.org/sh-2" },
  { id: "sh-3", house_bol: "HB-3", supplier_id: "sp-b", importer_id: "buy-2", importer_name: "B Supply", shipment_date: "2026-07-12", weight_kg: "8000", quantity: "60", container_count: "1", product_description: "FAUCET MIXER", estimated_freight_usd: "2000", source_channel: "importyeti_free_web", source_url: "https://example.org/sh-3" },
];

test("HS evidence normalizes display punctuation and excludes missing codes from the denominator", () => {
  assert.deepEqual(parseHsCodes("8481.80, 8481.90"), ["848180", "848190"]);
  assert.deepEqual(calculateHsEvidence([
    { hs_codes: "8481.80" },
    { hs_codes: "3922.10" },
    { hs_codes: "" },
    { hs_codes: null },
  ], "848180"), {
    totalRelationships: 4,
    codedRelationships: 2,
    matchedRelationships: 1,
    missingRelationships: 2,
    matchPercent: 50,
  });
});

test("HS evidence reports unavailable instead of a false zero when every code is missing", () => {
  assert.deepEqual(calculateHsEvidence([{ hs_codes: "" }, {}], "848180"), {
    totalRelationships: 2,
    codedRelationships: 0,
    matchedRelationships: 0,
    missingRelationships: 2,
    matchPercent: null,
  });
});

test("buyer detail uses coverage-aware HS evidence and removes the disabled legacy panel", () => {
  const page = readFileSync(new URL("../app/page.tsx", import.meta.url), "utf8");
  assert.match(page, /calculateHsEvidence\(rels,selectedProduct\.hsCode\)/);
  assert.match(page, /hsEvidence\.codedRelationships/);
  assert.doesNotMatch(page, /hs_codes\|\|""\)\.includes\(selectedProduct\.hsCode\)/);
  assert.doesNotMatch(page, /companyDetail&&false|importer-monthly-detail|setCompanyDetailMonth|companyDetailMonth/);
});

test("buyer detail preserves real zeroes and recognizes supported website verification states", () => {
  const page = readFileSync(new URL("../app/page.tsx", import.meta.url), "utf8");
  assert.match(page, /\["verified","verified_company_site"\]\.includes\(c\.website_status\|\|""\)/);
  assert.match(page, /Number\(item\.captured_bols\|\|0\)\.toLocaleString/);
  assert.match(page, /item\.supplier_count\?\?0/);
  assert.doesNotMatch(page, /item\.captured_bols\|\|"—"|item\.supplier_count\|\|"—"/);
});

test("provider shipment rows normalize into canonical Shipment entities", () => {
  const shipments = normalizeShipments({ shipments: RAW_ROWS });
  assert.equal(shipments.length, 3);
  const first = shipments[0];
  assert.equal(first.id, "sh-1");
  assert.equal(first.source, "importyeti_free_web");
  assert.equal(first.sourceShipmentId, "HB-1");
  assert.equal(first.importerId, "buy-1");
  assert.equal(first.importerName, "A Plumbing");
  assert.equal(first.productCategory, "faucet");
  assert.ok(first.productKeywords.includes("faucet"));
  assert.equal(first.month, "2026-07");
  assert.equal(first.year, 2026);
  assert.equal(first.weight, 12000);
  assert.equal(first.quantity, 100);
  assert.equal(first.value, 3400);
  assert.equal(first.containerCount, 2);
  assert.equal(shipments[1].productCategory, "shower");
  const passthrough: Shipment[] = normalizeShipments(shipments);
  assert.equal(passthrough.length, shipments.length);
  assert.equal(passthrough[0], shipments[0]);
  assert.deepEqual(passthrough, shipments);
});

test("hot product ranking consolidates noisy descriptions into sales products",()=>{
  assert.deepEqual(classifySalesProducts("Bathtubshower Traypacking"),["shower_tray","bathtub"]);
  assert.deepEqual(classifySalesProducts("Faucet Accessories"),["faucet_parts"]);
  assert.deepEqual(classifySalesProducts("Kitchen faucets"),[]);
  const ranked=rankHotProducts([
    {id:"1",importer_id:"a",importer_name:"Buyer A",product_description:"Shower Tray",shipment_date:"2026-07-01",weight_kg:1000},
    {id:"2",importer_id:"b",importer_name:"Buyer B",product_description:"Bathtub Shower Tray Drainer",shipment_date:"2026-06-01",weight_kg:2000},
    {id:"3",importer_id:"a",importer_name:"Buyer A",product_description:"Faucet",shipment_date:"2026-07-02",weight_kg:500},
  ]);
  const trays=ranked.find(product=>product.id==="shower_tray")!;
  assert.equal(trays.shipments,2);assert.equal(trays.buyers,2);assert.equal(trays.recentShipments,2);assert.deepEqual(trays.topBuyers,[{id:"a",name:"Buyer A",shipments:1},{id:"b",name:"Buyer B",shipments:1}]);
  assert.match(trays.productSearchUrl,/google\.com\/search/);
  assert.match(trays.imageSearchUrl,/tbm=isch/);
  assert.ok(trays.heatScore>ranked.find(product=>product.id==="bathroom_faucet")!.heatScore);
  assert.equal(trays.representativeProduct?.brand,"DreamLine");
  assert.match(ranked.find(product=>product.id==="bathtub")!.representativeProduct?.imageUrl||"",/^https:\/\//);
});

test("shipment entity creation derives month and year and tolerates missing fields", () => {
  const shipment = shipmentFromRow({ id: "s-min", importer_name: "X", shipment_date: "2026-07-03" });
  assert.equal(shipment.month, "2026-07");
  assert.equal(shipment.year, 2026);
  assert.equal(shipment.productCategory, "unknown");
  assert.deepEqual(shipment.productKeywords, []);
  assert.equal(shipment.weight, null);
  assert.equal(shipment.quantity, null);
  assert.equal(shipment.hsCode, null);
  assert.equal(shipment.originCountry, null);
  assert.equal(shipment.destinationCountry, null);
  assert.equal(shipment.sourceShipmentId, "s-min");
});

test("enrichShipmentRow adds canonical fields without dropping raw columns", () => {
  const enriched = enrichShipmentRow(RAW_ROWS[0]);
  assert.equal(enriched.weight_kg, "12000");
  assert.equal(enriched.weight, 12000);
  assert.equal(enriched.productCategory, "faucet");
  assert.ok((enriched.productKeywords as string[]).includes("faucet"));
  assert.equal(enriched.month, "2026-07");
  assert.equal(enriched.hsCode, null);
});

test("shipment repository saves and queries normalized shipments", async () => {
  const db = new MockDb(RAW_ROWS);
  const repository = new ShipmentRepository(db);
  const saved = await repository.save([
    { id: "canon-1", source: "importyeti_free_web", sourceShipmentId: "HB-9", importerId: "buy-1", importerName: "A Plumbing", supplierId: "sp-a", productCategory: "faucet", productKeywords: ["faucet"], hsCode: "848180", originCountry: "CN", destinationCountry: "US", shipmentDate: "2026-07-20", month: "2026-07", year: 2026, quantity: 10, weight: 900, value: 100, containerCount: 1, sourceUrl: "https://example.org/9" },
    { id: "skip-me", source: "importyeti_free_web", sourceShipmentId: "HB-10", importerId: null, importerName: null, supplierId: null, productCategory: "unknown", productKeywords: [], hsCode: null, originCountry: null, destinationCountry: null, shipmentDate: null, month: null, year: null, quantity: null, weight: null, value: null, containerCount: null, sourceUrl: null },
  ]);
  assert.equal(saved, 1);
  const write = db.calls[0];
  assert.ok(write.sql.includes("INSERT INTO importyeti_web_shipments"));
  assert.ok(write.sql.includes("ON CONFLICT(id) DO NOTHING"));
  assert.equal(write.args[0], "canon-1");
  assert.equal(write.args[4], "2026-07-20");

  const byProduct = await repository.findByProduct("faucet", ["2026-07"]);
  const productCall = db.calls.at(-1);
  assert.ok(productCall!.sql.includes("product_description LIKE ?"));
  assert.ok(productCall!.sql.includes("substr(shipment_date, 1, 7) IN (?)"));
  assert.equal(productCall!.args[0], "%faucet%");
  assert.equal(byProduct.length, 3);
  assert.equal(byProduct[0].id, "sh-1");

  await repository.findByImporter("buy-1", ["2026-07"]);
  assert.ok(db.calls.at(-1)!.sql.includes("importer_id = ?"));
  await repository.findBySupplier("sp-a", ["2026-07"]);
  assert.ok(db.calls.at(-1)!.sql.includes("supplier_id = ?"));
  await repository.findByMonth(["2026-07"]);
  assert.ok(db.calls.at(-1)!.sql.includes("substr(shipment_date, 1, 7) IN (?)"));
  const queried = await repository.query({ product: "shower", months: ["2026-07"], importerId: "buy-1" });
  assert.ok(db.calls.at(-1)!.sql.includes("importer_id = ?"));
  assert.ok(db.calls.at(-1)!.sql.includes("product_description LIKE ?"));
  assert.equal(queried.length, 3);
});

test("ranking is generated from normalized shipments", () => {
  const result = normalizeShipmentRanking({ shipments: RAW_ROWS }, {
    intent: "buyer_ranking",
    subject: "faucet",
    market: "US",
    period: "2026-07",
    months: ["2026-07"],
    ranking: { metric: "shipment_count", limit: 50 },
  });
  assert.equal(result.kind, "ranking");
  const ranking = result.ranking;
  assert.equal(ranking.totalCount, 2);
  assert.equal(ranking.ranked[0].name, "A Plumbing");
  assert.equal(ranking.ranked[0].metric_value, 2);
  assert.equal(ranking.ranked[1].metric_value, 1);
  assert.equal(ranking.productCategory, "faucet");
  const bySuppliers = normalizeShipmentRanking({ shipments: RAW_ROWS }, {
    intent: "buyer_ranking",
    subject: "faucet",
    market: "US",
    period: "2026-07",
    months: ["2026-07"],
    ranking: { metric: "supplier_count", limit: 50 },
  });
  const bySuppliersRanking = bySuppliers.kind === "ranking" ? bySuppliers.ranking : null;
  assert.equal(bySuppliersRanking?.ranked[0].metric_value, 1);
});

test("Query Engine shipment flow: Top20 reuses Top50 ranking and cache prevents duplicate provider calls", async () => {
  const rows: Array<Record<string, unknown>> = [];
  for (let importer = 0; importer < 5; importer += 1) {
    for (let index = 0; index < 12; index += 1) {
      rows.push({
        id: `sh-${importer}-${index}`,
        importer_id: `buy-${importer}`,
        importer_name: `Importer ${importer}`,
        supplier_id: `sp-${importer % 2}`,
        shipment_date: `2026-07-${String(index + 1).padStart(2, "0")}`,
        weight_kg: 1000,
        product_description: "FAUCET",
        source_channel: "importyeti_free_web",
      });
    }
  }
  const db = new MockDb(rows);
  const provider = new ShipmentRankingProvider({ db });
  let persisted: unknown = null;
  const cache = new MemoryCache();
  const resolver = new CacheResolver({ cache, providers: [provider], resolveProvider: () => provider });
  const engine = new QueryEngine({
    capabilities: [shipmentDataCapability],
    registry: { list: () => [], route: () => provider },
    resolver,
    budget: new FixedBudget(0),
    logger: { log: async () => {} },
    persistRanking: async ranking => {
      persisted = ranking;
    },
  });

  const top50 = await engine.execute({
    intent: "buyer_ranking",
    product: "faucet",
    market: "US",
    period: { from: "2026-07", to: "2026-07" },
    ranking: { metric: "shipment_count", limit: 50 },
  });
  assert.equal(top50.status, "completed");
  assert.equal(db.calls.length, 1);
  const top50View = top50.data?.kind === "ranking" ? top50.data.ranking : null;
  assert.equal(top50View?.totalCount, 5);
  assert.equal(top50View?.topCount, 5);
  const stored = persisted as { topLimit: number; topCount: number; ranked: unknown[] };
  assert.equal(stored.topLimit, 50);
  assert.equal(stored.ranked.length, 5);

  const top20 = await engine.execute({
    intent: "buyer_ranking",
    product: "faucet",
    market: "US",
    period: { from: "2026-07", to: "2026-07" },
    ranking: { metric: "shipment_count", limit: 20 },
  });
  assert.equal(top20.status, "cache_hit");
  assert.equal(top20.cached, true);
  assert.equal(db.calls.length, 1);
  const top20View = top20.data?.kind === "ranking" ? top20.data.ranking : null;
  assert.equal(top20View?.topLimit, 20);
  assert.equal(top20View?.topCount, 5);
  assert.equal(top20View?.totalCount, 5);
});
