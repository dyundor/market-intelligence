import { NextRequest, NextResponse } from "next/server";
import { env } from "cloudflare:workers";
import { createQueryEngine, FixedBudget } from "../_shared/query-engine-production";
import { D1CacheAdapter } from "../_shared/query-engine-d1";

const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

export async function GET(request: NextRequest) {
  const market = request.nextUrl.searchParams.get("market") || "美国";
  const flow = request.nextUrl.searchParams.get("flow") || "进口";
  const product = request.nextUrl.searchParams.get("product") || "龙头及阀类";
  const metric = (request.nextUrl.searchParams.get("metric") || "shipment_count").trim();
  const months = (request.nextUrl.searchParams.get("months") || "").split(",").filter(value => /^20\d{2}-\d{2}$/.test(value));

  if (market !== "美国" || flow !== "进口") {
    return NextResponse.json({ available: false, reason: "当前企业级 ImportYeti 数据仅覆盖美国海运进口。", importers: [], suppliers: [], requestedMonths: months, storedShipmentCoverage: [], dataset: "importyeti_free_web", market, flow, product, hsCode: "", latestAvailableMonth: "" });
  }

  const engine = createQueryEngine({
    db: env.DB,
    budget: new FixedBudget(0),
    cache: new D1CacheAdapter("importyeti_web", CACHE_TTL_MS, CACHE_TTL_MS),
  });
  const result = await engine.execute({
    intent: "buyer_ranking",
    subject: product,
    market: "US",
    period: months.at(-1) || "2026-07",
    months,
    flow: "import",
    ranking: { metric, limit: 50 },
  });
  if (result.status === "failed") {
    return NextResponse.json({ available: false, reason: "企业级数据暂时不可用。", detail: result.reason, importers: [], suppliers: [], requestedMonths: months, storedShipmentCoverage: [], dataset: "importyeti_free_web", market, flow, product, hsCode: "", latestAvailableMonth: "" }, { status: 502 });
  }
  const ranking = result.data?.kind === "ranking" ? result.data.ranking : null;
  if (!ranking) {
    return NextResponse.json({ available: false, reason: "企业级数据暂时不可用。", importers: [], suppliers: [], requestedMonths: months, storedShipmentCoverage: [], dataset: "importyeti_free_web", market, flow, product, hsCode: "", latestAvailableMonth: "" }, { status: 502 });
  }
  return NextResponse.json({
    ...ranking,
    importers: ranking.ranked,
    ranking: {
      metric: ranking.metric,
      productCategory: ranking.productCategory,
      topLimit: ranking.topLimit,
      topCount: ranking.topCount,
      totalCount: ranking.totalCount,
    },
    query: { queryId: result.queryId, intent: result.intent, source: result.source, cached: result.cached, cost: result.cost },
  });
}
