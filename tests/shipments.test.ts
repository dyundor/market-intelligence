import assert from "node:assert/strict";
import test from "node:test";
import { classifySalesProducts, rankHotProducts, aggregateProductBuyers, enrichProductBuyers, REPRESENTATIVE_PRODUCTS } from "../lib/products/hot-products.ts";
import { computeConfidence } from "../lib/data-confidence.ts";
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
import { computeGrowthRate, computeTrend, aggregateMonthly, type TrendPoint, type TrendMetric } from "../lib/products/trend-metrics.ts";

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

test("REPRESENTATIVE_PRODUCTS has exactly 9 entries and every entry has a title and brand", () => {
  const entries = Object.entries(REPRESENTATIVE_PRODUCTS);
  assert.equal(entries.length, 9);
  for (const [id, product] of entries) {
    assert.ok(product.title, `REPRESENTATIVE_PRODUCTS["${id}"].title must not be empty`);
    assert.ok(product.brand, `REPRESENTATIVE_PRODUCTS["${id}"].brand must not be empty`);
  }
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

test("aggregateProductBuyers groups shipments by product and buyer", () => {
  const rows = [
    { id: "1", importer_id: "a", importer_name: "Buyer A", product_description: "Shower Tray", shipment_date: "2026-07-01", weight_kg: 1000 },
    { id: "2", importer_id: "b", importer_name: "Buyer B", product_description: "Bathtub shower tray drainer", shipment_date: "2026-06-01", weight_kg: 2000 },
    { id: "3", importer_id: "a", importer_name: "Buyer A", product_description: "Shower base acrylic", shipment_date: "2026-07-02", weight_kg: 500 },
  ];
  const buyers = aggregateProductBuyers(rows, "shower_tray");
  assert.equal(buyers.length, 2);
  assert.equal(buyers[0].importerId, "a");
  assert.equal(buyers[0].shipments, 2);
  assert.equal(buyers[0].latestShipmentDate, "2026-07-02");
  assert.equal(buyers[1].importerId, "b");
  assert.equal(buyers[1].shipments, 1);
  const empty = aggregateProductBuyers(rows, "nonexistent");
  assert.equal(empty.length, 0);
});

test("enrichProductBuyers sorts qualified first and marks excluded", () => {
  const aggregates = [
    { importerId: "a", importerName: "A", shipments: 5, weightKg: 1000, latestShipmentDate: "2026-01-01" },
    { importerId: "b", importerName: "B", shipments: 3, weightKg: 500, latestShipmentDate: "2025-01-01" },
  ];
  const entities = [
    { id: "a", name: "Buyer A", identity_status: "source_verified", identity_confidence: 95, identity_notes: null, website: "https://a.com", website_status: "verified", country: "US" },
    { id: "b", name: "Buyer B", identity_status: "confirmed_manufacturer", identity_confidence: 80, identity_notes: null, website: null, website_status: null, country: null },
  ];
  const watchlist = [
    { company_id: "a", lead_status: "contact_ready", outreach_strategy: "OEM/ODM Pitch", commercial_fit_score: 70, outreach_score: 60, recommended_products: "Faucets" },
    { company_id: "b", lead_status: null, outreach_strategy: null, commercial_fit_score: null, outreach_score: null, recommended_products: null },
  ];
  const verifiedContacts = new Set(["a"]);
  const result = enrichProductBuyers(aggregates, entities, watchlist, verifiedContacts);
  assert.equal(result.length, 2);
  assert.equal(result[0].id, "a");
  assert.equal(result[0].excluded, false);
  assert.equal(result[0].hasVerifiedContact, true);
  assert.equal(result[0].leadStatus, "contact_ready");
  assert.equal(result[1].id, "b");
  assert.equal(result[1].excluded, true);
  assert.equal(result[1].exclusionReason, "同行制造商 — 不宜作为客户开发");
});

test("computeConfidence calculates score on log scale and correct ratios", () => {
  const result = computeConfidence({
    shipmentRecords: 500,
    matchedRecords: 400,
    mixedRecords: 50,
    categories: 1,
    lastUpdated: "2026-07-15",
    dataSource: "stored_us_ocean_import_shipments",
  });
  assert.equal(result.sampleSize, 500);
  assert.equal(result.score, Math.round(Math.log10(500) / Math.log10(1000) * 100));
  assert.equal(result.identifiedRatio, 400 / 500);
  assert.equal(result.mixedLoadRatio, 50 / 400);
  assert.equal(result.unclassifiedRatio, (500 - 400) / 500);
  assert.equal(result.dataSource, "stored_us_ocean_import_shipments");
  assert.equal(result.lastUpdated, "2026-07-15");
  assert.ok(result.explanation.includes("500 shipment records"));
  assert.ok(result.explanation.includes("80% classified"));
  assert.ok(result.explanation.includes("13% from mixed-product shipments"));
});

test("computeConfidence with large sample reaches score 100", () => {
  const result = computeConfidence({
    shipmentRecords: 5000,
    matchedRecords: 4000,
    mixedRecords: 800,
    categories: 1,
    lastUpdated: "2026-07-15",
  });
  assert.equal(result.score, 100);
  assert.equal(result.sampleSize, 5000);
  assert.ok(result.explanation.includes("large sample, high confidence"));
});

test("computeConfidence with small sample stays below 100", () => {
  const result = computeConfidence({
    shipmentRecords: 10,
    matchedRecords: 8,
    mixedRecords: 2,
    categories: 1,
    lastUpdated: "2026-07-15",
  });
  assert.ok(result.score < 100);
  assert.ok(result.score > 0);
  assert.equal(result.identifiedRatio, 0.8);
  assert.equal(result.mixedLoadRatio, 0.25);
  assert.ok(result.explanation.includes("small sample, lower confidence"));
});

test("computeConfidence with zero records handles edge case", () => {
  const result = computeConfidence({
    shipmentRecords: 0,
    matchedRecords: 0,
    mixedRecords: 0,
    categories: 1,
    lastUpdated: "",
  });
  assert.equal(result.score, 0);
  assert.equal(result.identifiedRatio, 0);
  assert.equal(result.mixedLoadRatio, 0);
  assert.equal(result.unclassifiedRatio, 0);
  assert.ok(result.explanation.includes("No shipment records"));
});

test("rankHotProducts includes confidence in each product", () => {
  const rows = [
    { id: "1", importer_id: "a", importer_name: "Buyer A", product_description: "Shower Tray", shipment_date: "2026-07-01", weight_kg: 1000 },
    { id: "2", importer_id: "b", importer_name: "Buyer B", product_description: "Bathtub Shower Tray Drainer", shipment_date: "2026-06-01", weight_kg: 2000 },
    { id: "3", importer_id: "a", importer_name: "Buyer A", product_description: "Faucet", shipment_date: "2026-07-02", weight_kg: 500 },
  ];
  const ranked = rankHotProducts(rows);
  for (const product of ranked) {
    assert.ok(product.confidence, `Product ${product.id} missing confidence`);
    assert.equal(typeof product.confidence.score, "number");
    assert.equal(typeof product.confidence.sampleSize, "number");
    assert.equal(product.confidence.sampleSize, 3);
    assert.equal(typeof product.confidence.identifiedRatio, "number");
    assert.equal(typeof product.confidence.mixedLoadRatio, "number");
    assert.equal(typeof product.confidence.unclassifiedRatio, "number");
    assert.ok(product.confidence.explanation.length > 0);
    assert.equal(product.confidence.dataSource, "stored_us_ocean_import_shipments");
  }
  const trays = ranked.find(product => product.id === "shower_tray")!;
  assert.ok(trays.shipments > 0);
  assert.ok(trays.confidence.identifiedRatio > 0);
});

// --- TrendMetric tests ---

test("computeGrowthRate returns null for first month and zero prev", () => {
  assert.equal(computeGrowthRate(null, 10), null);
  assert.equal(computeGrowthRate(0, 10), null);
});

test("computeGrowthRate calculates MoM percentage change", () => {
  assert.equal(computeGrowthRate(10, 15), 50);
  assert.equal(computeGrowthRate(10, 5), -50);
  assert.equal(computeGrowthRate(5, 5), 0);
  assert.equal(computeGrowthRate(100, 200), 100);
});

test("computeTrend returns null for empty rows or unknown productId", () => {
  assert.equal(computeTrend([], "shower_tray"), null);
  assert.equal(computeTrend([{ id: "1", importer_id: "a", importer_name: "A", product_description: "Faucet", shipment_date: "2026-07-01", weight_kg: 100 }], "shower_tray"), null);
});

test("computeTrend groups shipments by month and computes metrics", () => {
  const rows: Array<{ id: string; importer_id: string | null; importer_name: string | null; product_description: string | null; shipment_date: string | null; weight_kg: number | null }> = [
    { id: "1", importer_id: "a", importer_name: "Buyer A", product_description: "Shower Tray", shipment_date: "2026-06-15", weight_kg: 1000 },
    { id: "2", importer_id: "a", importer_name: "Buyer A", product_description: "Shower Tray", shipment_date: "2026-07-01", weight_kg: 2000 },
    { id: "3", importer_id: "b", importer_name: "Buyer B", product_description: "Shower Tray", shipment_date: "2026-07-15", weight_kg: 1500 },
    { id: "4", importer_id: "a", importer_name: "Buyer A", product_description: "Shower Tray", shipment_date: "2026-08-10", weight_kg: 3000 },
  ];
  const trend = computeTrend(rows, "shower_tray");
  assert.ok(trend, "Expected a TrendMetric result");
  assert.equal(trend!.productId, "shower_tray");
  assert.equal(trend!.productName, "Shower trays");
  assert.equal(trend!.points.length, 3);

  assert.equal(trend!.points[0].month, "2026-06");
  assert.equal(trend!.points[0].shipments, 1);
  assert.equal(trend!.points[0].buyers, 1);
  assert.equal(trend!.points[0].weightKg, 1000);
  assert.deepEqual(trend!.points[0].uniqueBuyerIds, ["a"]);
  assert.equal(trend!.points[0].growthRate, null);

  assert.equal(trend!.points[1].month, "2026-07");
  assert.equal(trend!.points[1].shipments, 2);
  assert.equal(trend!.points[1].buyers, 2);
  assert.equal(trend!.points[1].weightKg, 3500);
  assert.equal(trend!.points[1].growthRate, 100);

  assert.equal(trend!.points[2].month, "2026-08");
  assert.equal(trend!.points[2].shipments, 1);
  assert.equal(trend!.points[2].weightKg, 3000);
  assert.equal(trend!.points[2].growthRate, -50);

  assert.equal(trend!.summary.totalShipments, 4);
  assert.equal(trend!.summary.totalBuyers, 2);
  assert.equal(trend!.summary.totalWeightKg, 7500);
  assert.equal(trend!.summary.avgMonthlyGrowth, 25);
  assert.equal(trend!.summary.bestMonth, "2026-07");
  assert.equal(trend!.summary.worstMonth, "2026-08");
  assert.equal(trend!.summary.periodStart, "2026-06");
  assert.equal(trend!.summary.periodEnd, "2026-08");
});

test("computeTrend handles zero weight and missing shipment_date", () => {
  const rows: Array<{ id: string; importer_id: string | null; importer_name: string | null; product_description: string | null; shipment_date: string | null; weight_kg: number | null }> = [
    { id: "1", importer_id: "a", importer_name: "A", product_description: "Faucet", shipment_date: "2026-07-01", weight_kg: 0 },
    { id: "2", importer_id: "b", importer_name: "B", product_description: "Faucet mixer", shipment_date: null, weight_kg: 500 },
    { id: "3", importer_id: "c", importer_name: "C", product_description: "Faucet", shipment_date: "2026-07-15", weight_kg: null },
  ];
  const trend = computeTrend(rows, "bathroom_faucet");
  assert.ok(trend);
  assert.equal(trend!.points.length, 1);
  assert.equal(trend!.points[0].month, "2026-07");
  assert.equal(trend!.points[0].shipments, 2);
  assert.equal(trend!.points[0].weightKg, 0);
  assert.equal(trend!.points[0].buyers, 2);
  assert.equal(trend!.summary.totalWeightKg, 0);
});

test("computeTrend detects mixed-product shipments", () => {
  const rows: Array<{ id: string; importer_id: string | null; importer_name: string | null; product_description: string | null; shipment_date: string | null; weight_kg: number | null }> = [
    { id: "1", importer_id: "a", importer_name: "A", product_description: "Shower Tray Bathtub", shipment_date: "2026-07-01", weight_kg: 1000 },
    { id: "2", importer_id: "b", importer_name: "B", product_description: "Shower Tray", shipment_date: "2026-07-02", weight_kg: 500 },
  ];
  const trend = computeTrend(rows, "shower_tray");
  assert.ok(trend);
  assert.equal(trend!.points.length, 1);
  assert.equal(trend!.points[0].mixedCount, undefined); // mixedCount is used internally, not exposed on TrendPoint
  assert.equal(trend!.points[0].confidence.mixedLoadRatio, 0.5);
});

test("computeTrend returns null when no rows match productId", () => {
  const rows: Array<{ id: string; importer_id: string | null; importer_name: string | null; product_description: string | null; shipment_date: string | null; weight_kg: number | null }> = [
    { id: "1", importer_id: "a", importer_name: "A", product_description: "Kitchen Faucet", shipment_date: "2026-07-01", weight_kg: 100 },
  ];
  assert.equal(computeTrend(rows, "bathroom_faucet"), null);
});

test("computeTrend confidence per month identifies data quality", () => {
  const rows: Array<{ id: string; importer_id: string | null; importer_name: string | null; product_description: string | null; shipment_date: string | null; weight_kg: number | null }> = [
    { id: "1", importer_id: "a", importer_name: "A", product_description: "Shower Tray", shipment_date: "2026-07-01", weight_kg: 100 },
    { id: "2", importer_id: "a", importer_name: "A", product_description: "Shower Tray Bathtub", shipment_date: "2026-07-02", weight_kg: 200 },
  ];
  const trend = computeTrend(rows, "shower_tray")!;
  const pt = trend.points[0];
  assert.ok(pt.confidence.score > 0);
  assert.equal(pt.confidence.sampleSize, 2);
  assert.equal(pt.confidence.identifiedRatio, 1);
  assert.equal(pt.confidence.mixedLoadRatio, 0.5);
  assert.equal(pt.confidence.dataSource, "stored_us_ocean_import_shipments");
  assert.equal(pt.confidence.lastUpdated, "2026-07");
  assert.ok(pt.confidence.explanation.includes("records"));
});

test("aggregateMonthly calls computeTrend with 12-month default", () => {
  const rows: Array<{ id: string; importer_id: string | null; importer_name: string | null; product_description: string | null; shipment_date: string | null; weight_kg: number | null }> = [];
  for (let m = 1; m <= 12; m += 1) {
    rows.push({ id: `s-${m}`, importer_id: "a", importer_name: "A", product_description: "Faucet", shipment_date: `2025-${String(m).padStart(2, "0")}-01`, weight_kg: 100 });
    rows.push({ id: `s-${m + 12}`, importer_id: "a", importer_name: "A", product_description: "Faucet", shipment_date: `2026-${String(m).padStart(2, "0")}-01`, weight_kg: 100 });
  }
  const trend = aggregateMonthly(rows, "bathroom_faucet");
  assert.ok(trend);
  assert.equal(trend!.points.length, 12);
  assert.equal(trend!.points[0].month, "2026-01");
  assert.equal(trend!.points[11].month, "2026-12"); // 2025 months are out of the 12-month window
});

test("computeTrend sorts points by month ascending", () => {
  const rows: Array<{ id: string; importer_id: string | null; importer_name: string | null; product_description: string | null; shipment_date: string | null; weight_kg: number | null }> = [
    { id: "3", importer_id: "a", importer_name: "A", product_description: "Shower Tray", shipment_date: "2026-08-01", weight_kg: 100 },
    { id: "1", importer_id: "a", importer_name: "A", product_description: "Shower Tray", shipment_date: "2026-06-01", weight_kg: 100 },
    { id: "2", importer_id: "a", importer_name: "A", product_description: "Shower Tray", shipment_date: "2026-07-01", weight_kg: 100 },
  ];
  const trend = computeTrend(rows, "shower_tray")!;
  assert.equal(trend.points.length, 3);
  assert.equal(trend.points[0].month, "2026-06");
  assert.equal(trend.points[1].month, "2026-07");
  assert.equal(trend.points[2].month, "2026-08");
});

test("computeTrend summary handles single month", () => {
  const rows: Array<{ id: string; importer_id: string | null; importer_name: string | null; product_description: string | null; shipment_date: string | null; weight_kg: number | null }> = [
    { id: "1", importer_id: "a", importer_name: "A", product_description: "Faucet", shipment_date: "2026-07-01", weight_kg: 100 },
  ];
  const trend = computeTrend(rows, "bathroom_faucet")!;
  assert.equal(trend.summary.totalShipments, 1);
  assert.equal(trend.summary.avgMonthlyGrowth, 0);
  assert.equal(trend.summary.bestMonth, "2026-07");
  assert.equal(trend.summary.worstMonth, "2026-07");
  assert.equal(trend.summary.periodStart, "2026-07");
  assert.equal(trend.summary.periodEnd, "2026-07");
});

test("computeTrend with months=3 limits to last 3 months", () => {
  const rows: Array<{ id: string; importer_id: string | null; importer_name: string | null; product_description: string | null; shipment_date: string | null; weight_kg: number | null }> = [
    { id: "1", importer_id: "a", importer_name: "A", product_description: "Faucet", shipment_date: "2026-01-01", weight_kg: 100 },
    { id: "2", importer_id: "a", importer_name: "A", product_description: "Faucet", shipment_date: "2026-02-01", weight_kg: 100 },
    { id: "3", importer_id: "a", importer_name: "A", product_description: "Faucet", shipment_date: "2026-03-01", weight_kg: 100 },
    { id: "4", importer_id: "a", importer_name: "A", product_description: "Faucet", shipment_date: "2026-04-01", weight_kg: 100 },
    { id: "5", importer_id: "a", importer_name: "A", product_description: "Faucet", shipment_date: "2026-05-01", weight_kg: 100 },
  ];
  const trend = computeTrend(rows, "bathroom_faucet", 3);
  assert.ok(trend);
  assert.equal(trend!.points.length, 3);
  assert.equal(trend!.points[0].month, "2026-03");
  assert.equal(trend!.points[1].month, "2026-04");
  assert.equal(trend!.points[2].month, "2026-05");
  assert.equal(trend!.summary.periodStart, "2026-03");
  assert.equal(trend!.summary.periodEnd, "2026-05");
  assert.equal(trend!.summary.totalShipments, 3);
});

test("computeTrend with out-of-order data returns points sorted by month ascending", () => {
  const rows: Array<{ id: string; importer_id: string | null; importer_name: string | null; product_description: string | null; shipment_date: string | null; weight_kg: number | null }> = [
    { id: "3", importer_id: "a", importer_name: "A", product_description: "Valve", shipment_date: "2026-08-15", weight_kg: 300 },
    { id: "1", importer_id: "a", importer_name: "A", product_description: "Valve", shipment_date: "2026-06-01", weight_kg: 100 },
    { id: "4", importer_id: "b", importer_name: "B", product_description: "Valve", shipment_date: "2026-09-10", weight_kg: 400 },
    { id: "2", importer_id: "a", importer_name: "A", product_description: "Valve", shipment_date: "2026-07-20", weight_kg: 200 },
  ];
  const trend = computeTrend(rows, "valve")!;
  assert.equal(trend.points.length, 4);
  assert.equal(trend.points[0].month, "2026-06");
  assert.equal(trend.points[1].month, "2026-07");
  assert.equal(trend.points[2].month, "2026-08");
  assert.equal(trend.points[3].month, "2026-09");
  assert.equal(trend.points[0].shipments, 1);
  assert.equal(trend.points[1].shipments, 1);
  assert.equal(trend.points[2].shipments, 1);
  assert.equal(trend.points[3].shipments, 1);
});

test("computeTrend handles empty data gracefully", () => {
  const rows: Array<{ id: string; importer_id: string | null; importer_name: string | null; product_description: string | null; shipment_date: string | null; weight_kg: number | null }> = [];
  const result = computeTrend(rows, "shower_tray");
  assert.equal(result, null);
});

test("computeTrend with 2 months verifies growthRate calculation", () => {
  const rows: Array<{ id: string; importer_id: string | null; importer_name: string | null; product_description: string | null; shipment_date: string | null; weight_kg: number | null }> = [
    { id: "1", importer_id: "a", importer_name: "A", product_description: "Faucet", shipment_date: "2026-06-10", weight_kg: 500 },
    { id: "2", importer_id: "a", importer_name: "A", product_description: "Faucet", shipment_date: "2026-06-20", weight_kg: 500 },
    { id: "3", importer_id: "b", importer_name: "B", product_description: "Faucet", shipment_date: "2026-07-05", weight_kg: 1000 },
    { id: "4", importer_id: "b", importer_name: "B", product_description: "Faucet", shipment_date: "2026-07-15", weight_kg: 1000 },
    { id: "5", importer_id: "a", importer_name: "A", product_description: "Faucet", shipment_date: "2026-07-25", weight_kg: 1000 },
  ];
  const trend = computeTrend(rows, "bathroom_faucet")!;
  assert.equal(trend.points.length, 2);
  assert.equal(trend.points[0].month, "2026-06");
  assert.equal(trend.points[0].shipments, 2);
  assert.equal(trend.points[0].growthRate, null);
  assert.equal(trend.points[1].month, "2026-07");
  assert.equal(trend.points[1].shipments, 3);
  assert.equal(trend.points[1].growthRate, 50);
});
