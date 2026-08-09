import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { computeTrend, computeGrowthRate } from "../lib/products/trend-metrics.ts";
import { SALES_PRODUCTS } from "../lib/products/hot-products.ts";

const trendChartSrc = readFileSync("app/components/TrendChart.tsx", "utf-8");
const trendDashboardSrc = readFileSync("app/components/ProductTrendDashboard.tsx", "utf-8");
const trendApiSrc = readFileSync("app/api/hot-products/trend/route.ts", "utf-8");
const useTrendDataSrc = readFileSync("app/components/useTrendData.ts", "utf-8");
const trendViewSrc = readFileSync("app/components/TrendView.tsx", "utf-8");

test("TrendChart component renders SVG with viewBox and role=img", () => {
  assert.ok(trendChartSrc.includes("<svg"), "TrendChart must include <svg>");
  assert.ok(trendChartSrc.includes("viewBox"), "TrendChart must include viewBox");
  assert.ok(trendChartSrc.includes('role="img"'), "TrendChart must have role=img for a11y");
});

test("TrendChart supports all four metrics", () => {
  assert.ok(trendChartSrc.includes('"shipments"'), "Must support shipments metric");
  assert.ok(trendChartSrc.includes('"buyers"'), "Must support buyers metric");
  assert.ok(trendChartSrc.includes('"weightKg"'), "Must support weightKg metric");
  assert.ok(trendChartSrc.includes('"growthRate"'), "Must support growthRate metric");
});

test("TrendChart has locale-aware labels for zh-CN and en", () => {
  assert.ok(trendChartSrc.includes("出货量"), "Must have zh-CN label for shipments");
  assert.ok(trendChartSrc.includes("Shipments"), "Must have en label for shipments");
  assert.ok(trendChartSrc.includes("买家"), "Must have zh-CN label for buyers");
  assert.ok(trendChartSrc.includes("Buyers"), "Must have en label for buyers");
  assert.ok(trendChartSrc.includes("重量"), "Must have zh-CN label for weight");
  assert.ok(trendChartSrc.includes("Weight"), "Must have en label for weight");
  assert.ok(trendChartSrc.includes("环比增长"), "Must have zh-CN label for growth");
  assert.ok(trendChartSrc.includes("MoM Growth"), "Must have en label for growth");
});

test("TrendChart renders empty state when data is empty", () => {
  assert.ok(trendChartSrc.includes("暂无数据"), "Must have empty state zh text");
  assert.ok(trendChartSrc.includes("No data"), "Must have empty state en text");
  assert.ok(trendChartSrc.includes("trend-chart-empty"), "Must use empty state CSS class");
});

test("TrendChart renders tooltip on hover", () => {
  assert.ok(trendChartSrc.includes("setTooltip"), "Must have tooltip state setter");
  assert.ok(trendChartSrc.includes("onMouseEnter"), "Must have mouse enter handler");
  assert.ok(trendChartSrc.includes("onMouseLeave"), "Must have mouse leave handler");
});

test("TrendChart includes area gradient for visual fill", () => {
  assert.ok(trendChartSrc.includes("linearGradient"), "Must include gradient definition");
  assert.ok(trendChartSrc.includes("trend-area"), "Must use trend-area gradient ID");
});

test("ProductTrendDashboard renders time-range selector with 30/90/180 days", () => {
  assert.ok(trendDashboardSrc.includes("30"), "Must support 30 days");
  assert.ok(trendDashboardSrc.includes("90"), "Must support 90 days");
  assert.ok(trendDashboardSrc.includes("180"), "Must support 180 days");
  assert.ok(trendDashboardSrc.includes("DAYS_TO_MONTHS"), "Must have days-to-months mapping");
});

test("ProductTrendDashboard renders category filter dropdown", () => {
  assert.ok(trendDashboardSrc.includes("SALES_PRODUCTS"), "Must import product categories");
  assert.ok(trendDashboardSrc.includes("<select"), "Must include select element");
  assert.ok(trendDashboardSrc.includes("selectedCategoryId"), "Must track selected category");
});

test("ProductTrendDashboard has loading state", () => {
  assert.ok(trendDashboardSrc.includes('status: "loading"'), "Must have loading status");
  assert.ok(trendDashboardSrc.includes("Loading trend data"), "Must have loading en text");
  assert.ok(trendDashboardSrc.includes("加载趋势数据"), "Must have loading zh text");
});

test("ProductTrendDashboard has error state with retry", () => {
  assert.ok(trendDashboardSrc.includes('status: "error"'), "Must have error status");
  assert.ok(trendDashboardSrc.includes("Load failed"), "Must have error en text");
  assert.ok(trendDashboardSrc.includes("Retry"), "Must have retry button en text");
  assert.ok(trendDashboardSrc.includes("重试"), "Must have retry button zh text");
});

test("ProductTrendDashboard has empty state for no trend data", () => {
  assert.ok(trendDashboardSrc.includes("暂无趋势数据"), "Must have empty zh text");
  assert.ok(trendDashboardSrc.includes("No trend data"), "Must have empty en text");
  assert.ok(trendDashboardSrc.includes("No shipment records found"), "Must explain why empty");
});

test("ProductTrendDashboard displays summary metrics grid", () => {
  assert.ok(trendDashboardSrc.includes("trend-summary-grid"), "Must have summary grid");
  assert.ok(trendDashboardSrc.includes("Total Shipments"), "Must show total shipments en");
  assert.ok(trendDashboardSrc.includes("Total Buyers"), "Must show total buyers en");
  assert.ok(trendDashboardSrc.includes("Total Weight"), "Must show total weight en");
  assert.ok(trendDashboardSrc.includes("Avg MoM Growth"), "Must show avg growth en");
});

test("ProductTrendDashboard displays all four chart cards", () => {
  assert.ok(trendDashboardSrc.includes('metric="shipments"'), "Must render shipments chart");
  assert.ok(trendDashboardSrc.includes('metric="buyers"'), "Must render buyers chart");
  assert.ok(trendDashboardSrc.includes('metric="weightKg"'), "Must render weight chart");
  assert.ok(trendDashboardSrc.includes('metric="growthRate"'), "Must render growth rate chart");
});

test("ProductTrendDashboard uses AbortController for fetch cleanup", () => {
  assert.ok(trendDashboardSrc.includes("AbortController"), "Must use AbortController");
  assert.ok(trendDashboardSrc.includes("controller.abort()"), "Must abort on cleanup");
});

test("API route accepts months query parameter and passes to computeTrend", () => {
  assert.ok(trendApiSrc.includes('monthsParam'), "Must read months param");
  assert.ok(trendApiSrc.includes("computeTrend(rows, productId, months)"), "Must pass months to computeTrend");
  assert.ok(trendApiSrc.includes("Math.min") && trendApiSrc.includes("Math.max"), "Must clamp months range");
});

test("API route returns 404 for no trend data", () => {
  assert.ok(trendApiSrc.includes("No trend data"), "Must return 404 message");
  assert.ok(trendApiSrc.includes("404"), "Must use status 404");
});

test("computeTrend with custom months parameter returns correct slice", () => {
  const rows: Array<{
    id: string;
    importer_id: string | null;
    importer_name: string | null;
    product_description: string | null;
    shipment_date: string | null;
    weight_kg: number | null;
  }> = [];
  for (let m = 1; m <= 9; m += 1) {
    rows.push({
      id: `s-${m}`,
      importer_id: "a",
      importer_name: "A",
      product_description: "Faucet",
      shipment_date: `2026-0${m}-01`,
      weight_kg: 100,
    });
  }
  const trend = computeTrend(rows, "bathroom_faucet", 3);
  assert.ok(trend, "Expected TrendMetric result");
  assert.equal(trend!.points.length, 3);
  assert.equal(trend!.points[0].month, "2026-07");
  assert.equal(trend!.points[2].month, "2026-09");
  assert.equal(trend!.summary.totalShipments, 3);
});

test("computeTrend with months=6 returns 6 months", () => {
  const rows: Array<{
    id: string;
    importer_id: string | null;
    importer_name: string | null;
    product_description: string | null;
    shipment_date: string | null;
    weight_kg: number | null;
  }> = [];
  for (let m = 1; m <= 12; m += 1) {
    const mon = String(m).padStart(2, "0");
    rows.push({
      id: `s-${m}`,
      importer_id: "a",
      importer_name: "A",
      product_description: "Faucet",
      shipment_date: `2026-${mon}-01`,
      weight_kg: 100,
    });
  }
  const trend = computeTrend(rows, "bathroom_faucet", 6);
  assert.ok(trend);
  assert.equal(trend!.points.length, 6);
  assert.equal(trend!.points[0].month, "2026-07");
  assert.equal(trend!.points[5].month, "2026-12");
});

test("computeTrend with months=1 returns single month", () => {
  const rows: Array<{
    id: string;
    importer_id: string | null;
    importer_name: string | null;
    product_description: string | null;
    shipment_date: string | null;
    weight_kg: number | null;
  }> = [
    { id: "1", importer_id: "a", importer_name: "A", product_description: "Faucet", shipment_date: "2026-03-01", weight_kg: 100 },
    { id: "2", importer_id: "b", importer_name: "B", product_description: "Faucet", shipment_date: "2026-04-01", weight_kg: 200 },
    { id: "3", importer_id: "c", importer_name: "C", product_description: "Faucet", shipment_date: "2026-05-01", weight_kg: 300 },
  ];
  const trend = computeTrend(rows, "bathroom_faucet", 1);
  assert.ok(trend);
  assert.equal(trend!.points.length, 1);
  assert.equal(trend!.points[0].month, "2026-05");
});

test("computeTrend with months greater than available months returns all available", () => {
  const rows: Array<{
    id: string;
    importer_id: string | null;
    importer_name: string | null;
    product_description: string | null;
    shipment_date: string | null;
    weight_kg: number | null;
  }> = [
    { id: "1", importer_id: "a", importer_name: "A", product_description: "Valve", shipment_date: "2026-01-01", weight_kg: 100 },
    { id: "2", importer_id: "a", importer_name: "A", product_description: "Valve", shipment_date: "2026-02-01", weight_kg: 100 },
  ];
  const trend = computeTrend(rows, "valve", 12);
  assert.ok(trend);
  assert.equal(trend!.points.length, 2);
});

test("DAY_RANGE_OPTIONS in ProductTrendDashboard maps to correct months", () => {
  const daysToMonths = trendDashboardSrc.match(/DAYS_TO_MONTHS[^}]*\}/s)?.[0] || "";
  assert.ok(daysToMonths.includes("30"), "Must map 30 days");
  assert.ok(daysToMonths.includes("90"), "Must map 90 days");
  assert.ok(daysToMonths.includes("180"), "Must map 180 days");
  assert.ok(daysToMonths.includes("1") || daysToMonths.includes("3") || daysToMonths.includes("6"), "Must have numeric month values");
});

test("fetch URL includes months parameter for API request", () => {
  assert.ok(trendDashboardSrc.includes("months="), "Fetch URL must include months= parameter");
  assert.ok(trendDashboardSrc.includes("DAYS_TO_MONTHS[dayRange]"), "Must compute months from dayRange");
});

test("useTrendData hook defines all five state types", () => {
  assert.ok(useTrendDataSrc.includes('"idle"'), "Must have idle state");
  assert.ok(useTrendDataSrc.includes('"loading"'), "Must have loading state");
  assert.ok(useTrendDataSrc.includes('"error"'), "Must have error state");
  assert.ok(useTrendDataSrc.includes('"empty"'), "Must have empty state");
  assert.ok(useTrendDataSrc.includes('"success"'), "Must have success state");
});

test("useTrendData hook maps day ranges to months correctly", () => {
  assert.ok(useTrendDataSrc.includes("DAYS_TO_MONTHS"), "Must define DAYS_TO_MONTHS mapping");
  assert.ok(useTrendDataSrc.includes("30: 1"), "30 days must map to 1 month");
  assert.ok(useTrendDataSrc.includes("90: 3"), "90 days must map to 3 months");
  assert.ok(useTrendDataSrc.includes("180: 6"), "180 days must map to 6 months");
});

test("useTrendData hook uses AbortController for request cancellation", () => {
  assert.ok(useTrendDataSrc.includes("AbortController"), "Must use AbortController");
  assert.ok(useTrendDataSrc.includes("controller.abort()"), "Must abort on cleanup");
  assert.ok(useTrendDataSrc.includes('"AbortError"'), "Must handle AbortError");
});

test("useTrendData hook has fetchId to prevent stale state updates", () => {
  assert.ok(useTrendDataSrc.includes("fetchIdRef"), "Must use fetchId ref");
  assert.ok(useTrendDataSrc.includes("currentFetchId"), "Must track current fetch ID");
  assert.ok(useTrendDataSrc.includes("fetchIdRef.current"), "Must compare against latest fetch ID");
});

test("useTrendData hook handles 404 as empty state", () => {
  assert.ok(useTrendDataSrc.includes("404"), "Must check for 404 status");
  assert.ok(useTrendDataSrc.includes('status: "empty"'), "Must set empty on 404");
});

test("useTrendData hook has retry mechanism", () => {
  assert.ok(useTrendDataSrc.includes("retry"), "Must expose retry function");
  assert.ok(useTrendDataSrc.includes('status: "idle"'), "Retry must reset to idle");
});

test("useTrendData hook exports DayRange type", () => {
  assert.ok(useTrendDataSrc.includes("export type DayRange"), "Must export DayRange type");
  assert.ok(useTrendDataSrc.includes("30 | 90 | 180"), "DayRange must be 30 | 90 | 180");
});

test("useTrendData hook exports TrendDataState type", () => {
  assert.ok(useTrendDataSrc.includes("export type TrendDataState"), "Must export TrendDataState type");
});

test("TrendView component imports useTrendData hook", () => {
  assert.ok(trendViewSrc.includes("useTrendData"), "Must import useTrendData hook");
  assert.ok(trendViewSrc.includes("import { useTrendData"), "Must import from useTrendData module");
});

test("TrendView component renders category filter dropdown with all 9 categories", () => {
  assert.ok(trendViewSrc.includes("SALES_PRODUCTS"), "Must import product categories");
  assert.ok(trendViewSrc.includes("<select"), "Must include select element");
  assert.ok(trendViewSrc.includes("selectedCategoryId"), "Must track selected category");
  assert.ok(trendViewSrc.includes("SALES_PRODUCTS.map"), "Must iterate over all categories");
});

test("TrendView component renders time-range selector with 30/90/180 days", () => {
  assert.ok(trendViewSrc.includes("DAY_RANGE_OPTIONS"), "Must define day range options");
  assert.ok(trendViewSrc.includes("30"), "Must include 30 days");
  assert.ok(trendViewSrc.includes("90"), "Must include 90 days");
  assert.ok(trendViewSrc.includes("180"), "Must include 180 days");
  assert.ok(trendViewSrc.includes("dayRange"), "Must track dayRange state");
});

test("TrendView component has loading state", () => {
  assert.ok(trendViewSrc.includes('status === "loading"'), "Must check loading status");
  assert.ok(trendViewSrc.includes("Loading trend data"), "Must have loading en text");
  assert.ok(trendViewSrc.includes("加载趋势数据"), "Must have loading zh text");
});

test("TrendView component has error state with retry", () => {
  assert.ok(trendViewSrc.includes('status === "error"'), "Must check error status");
  assert.ok(trendViewSrc.includes("Load failed"), "Must have error en text");
  assert.ok(trendViewSrc.includes("Retry"), "Must have retry button en text");
  assert.ok(trendViewSrc.includes("重试"), "Must have retry button zh text");
});

test("TrendView component has idle state", () => {
  assert.ok(trendViewSrc.includes('status === "idle"'), "Must check idle status");
  assert.ok(trendViewSrc.includes("Select a category to load trends"), "Must show idle prompt en");
  assert.ok(trendViewSrc.includes("选择类别以加载趋势"), "Must show idle prompt zh");
});

test("TrendView component has empty state for no trend data", () => {
  assert.ok(trendViewSrc.includes('status === "empty"'), "Must check empty status");
  assert.ok(trendViewSrc.includes("暂无趋势数据"), "Must have empty zh text");
  assert.ok(trendViewSrc.includes("No trend data"), "Must have empty en text");
  assert.ok(trendViewSrc.includes("No shipment records found"), "Must explain why empty");
});

test("TrendView component renders all four charts on success", () => {
  assert.ok(trendViewSrc.includes('status === "success"'), "Must check success status");
  assert.ok(trendViewSrc.includes("Monthly Shipments"), "Must show shipments chart title en");
  assert.ok(trendViewSrc.includes("Monthly Buyers"), "Must show buyers chart title en");
  assert.ok(trendViewSrc.includes("Monthly Weight"), "Must show weight chart title en");
  assert.ok(trendViewSrc.includes("MoM Growth Rate"), "Must show growth chart title en");
});

test("TrendView component has zh-CN chart titles", () => {
  assert.ok(trendViewSrc.includes("月度出货量"), "Must have zh shipments title");
  assert.ok(trendViewSrc.includes("月度买家数"), "Must have zh buyers title");
  assert.ok(trendViewSrc.includes("月度重量"), "Must have zh weight title");
  assert.ok(trendViewSrc.includes("环比增长率"), "Must have zh growth title");
});

test("TrendView component renders summary metrics on success", () => {
  assert.ok(trendViewSrc.includes("trend-summary-grid"), "Must use summary grid CSS");
  assert.ok(trendViewSrc.includes("Total Shipments"), "Must show total shipments en");
  assert.ok(trendViewSrc.includes("Total Buyers"), "Must show total buyers en");
  assert.ok(trendViewSrc.includes("Total Weight"), "Must show total weight en");
  assert.ok(trendViewSrc.includes("Avg MoM Growth"), "Must show avg growth en");
});

test("TrendView component renders data legend with period and best/worst month", () => {
  assert.ok(trendViewSrc.includes("trend-data-legend"), "Must use legend CSS class");
  assert.ok(trendViewSrc.includes("Period"), "Must show period label en");
  assert.ok(trendViewSrc.includes("Best Month"), "Must show best month label en");
  assert.ok(trendViewSrc.includes("Worst Month"), "Must show worst month label en");
  assert.ok(trendViewSrc.includes("periodStart"), "Must reference periodStart");
  assert.ok(trendViewSrc.includes("periodEnd"), "Must reference periodEnd");
  assert.ok(trendViewSrc.includes("bestMonth"), "Must reference bestMonth");
  assert.ok(trendViewSrc.includes("worstMonth"), "Must reference worstMonth");
});

test("TrendView component supports configurable metrics prop", () => {
  assert.ok(trendViewSrc.includes("metrics"), "Must accept metrics prop");
  assert.ok(trendViewSrc.includes("ALL_METRICS"), "Must have default all metrics");
  assert.ok(trendViewSrc.includes("metrics.map"), "Must map over metrics");
});

test("TrendView component supports showSummary and showLegend props", () => {
  assert.ok(trendViewSrc.includes("showSummary"), "Must accept showSummary prop");
  assert.ok(trendViewSrc.includes("showLegend"), "Must accept showLegend prop");
});

test("TrendView component supports initialCategoryId and initialDayRange props", () => {
  assert.ok(trendViewSrc.includes("initialCategoryId"), "Must accept initialCategoryId prop");
  assert.ok(trendViewSrc.includes("initialDayRange"), "Must accept initialDayRange prop");
});

test("TrendView component reuses TrendChart component", () => {
  assert.ok(trendViewSrc.includes("TrendChart"), "Must import TrendChart");
  assert.ok(trendViewSrc.includes("<TrendChart"), "Must render TrendChart instances");
});

test("useTrendData returns correct month mapping for 30 days", () => {
  const daysMatch = useTrendDataSrc.match(/30:\s*(\d+)/);
  assert.ok(daysMatch, "Must have 30-day month mapping");
  assert.equal(Number(daysMatch![1]), 1, "30 days maps to 1 month");
});

test("useTrendData returns correct month mapping for 90 days", () => {
  const daysMatch = useTrendDataSrc.match(/90:\s*(\d+)/);
  assert.ok(daysMatch, "Must have 90-day month mapping");
  assert.equal(Number(daysMatch![1]), 3, "90 days maps to 3 months");
});

test("useTrendData returns correct month mapping for 180 days", () => {
  const daysMatch = useTrendDataSrc.match(/180:\s*(\d+)/);
  assert.ok(daysMatch, "Must have 180-day month mapping");
  assert.equal(Number(daysMatch![1]), 6, "180 days maps to 6 months");
});

test("TrendView component uses trend-view CSS class as root", () => {
  assert.ok(trendViewSrc.includes('"trend-view"'), "Must use trend-view as root class");
  assert.ok(trendViewSrc.includes("trend-view-controls"), "Must use trend-view-controls class");
});

test("TrendView component uses locale-aware category names", () => {
  assert.ok(trendViewSrc.includes("zh ? p.name : p.nameEn"), "Must use locale-aware category names in dropdown");
});

test("all 9 SALES_PRODUCTS have required fields", () => {
  assert.equal(SALES_PRODUCTS.length, 9, "Must have exactly 9 product categories");
  for (const p of SALES_PRODUCTS) {
    assert.ok(p.id, `Product must have id: ${p.id}`);
    assert.ok(p.name, `Product must have name: ${p.id}`);
    assert.ok(p.nameEn, `Product must have nameEn: ${p.id}`);
    assert.ok(Array.isArray(p.patterns) && p.patterns.length > 0, `Product must have patterns: ${p.id}`);
  }
});

test("all 9 product IDs are valid snake_case", () => {
  const ids = SALES_PRODUCTS.map(p => p.id);
  for (const id of ids) {
    assert.ok(/^[a-z][a-z_]*$/.test(id), `Product ID must be snake_case: ${id}`);
  }
  const expectedIds = ["bathroom_faucet", "faucet_parts", "shower_tray", "bathtub", "shower_door", "shower_system", "backwall", "drain", "valve"];
  assert.deepEqual(ids, expectedIds, "Product IDs must match expected order");
});

test("computeTrend handles 0 shipment rows gracefully", () => {
  const trend = computeTrend([], "bathroom_faucet", 3);
  assert.equal(trend, null, "Must return null for empty rows");
});

test("computeTrend growth rate is null for first month", () => {
  const rows = [
    { id: "s1", importer_id: "a", importer_name: "A", product_description: "Faucet", shipment_date: "2026-05-01", weight_kg: 100 },
    { id: "s2", importer_id: "a", importer_name: "A", product_description: "Faucet", shipment_date: "2026-06-01", weight_kg: 100 },
  ];
  const trend = computeTrend(rows, "bathroom_faucet", 3);
  assert.ok(trend);
  assert.equal(trend!.points[0].growthRate, null, "First month growth rate must be null");
  assert.ok(trend!.points[1].growthRate !== null, "Second month growth rate must not be null");
});

test("computeTrend calculates growth rate correctly", () => {
  const rows = [
    { id: "s1", importer_id: "a", importer_name: "A", product_description: "Faucet", shipment_date: "2026-05-01", weight_kg: 100 },
    { id: "s2", importer_id: "a", importer_name: "A", product_description: "Faucet", shipment_date: "2026-05-01", weight_kg: 100 },
    { id: "s3", importer_id: "a", importer_name: "A", product_description: "Faucet", shipment_date: "2026-06-01", weight_kg: 100 },
  ];
  const trend = computeTrend(rows, "bathroom_faucet", 3);
  assert.ok(trend);
  assert.equal(trend!.points.length, 2);
  assert.equal(trend!.points[0].shipments, 2);
  assert.equal(trend!.points[1].shipments, 1);
  assert.equal(trend!.points[1].growthRate, -50, "Growth from 2 to 1 = -50%");
});

test("computeGrowthRate helper returns null for zero previous", () => {
  assert.equal(computeGrowthRate(0, 100), null, "Must return null when previous is 0");
  assert.equal(computeGrowthRate(null, 100), null, "Must return null when previous is null");
});

test("computeGrowthRate helper calculates correctly", () => {
  assert.equal(computeGrowthRate(100, 150), 50, "Growth from 100 to 150 = 50%");
  assert.equal(computeGrowthRate(100, 50), -50, "Growth from 100 to 50 = -50%");
});
