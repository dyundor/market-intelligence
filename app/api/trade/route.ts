import { NextRequest, NextResponse } from "next/server";
import { env } from "cloudflare:workers";
import { createQueryEngine, FixedBudget } from "../_shared/query-engine-production";
import { D1CacheAdapter } from "../_shared/query-engine-d1";

const CACHE_TTL_MS = 5 * 60 * 1000;

const MARKET_ISO: Record<string, string> = {
  中国: "CN", 美国: "US", 加拿大: "CA", 阿联酋: "AE", 沙特阿拉伯: "SA", 卡塔尔: "QA", 科威特: "KW",
  阿曼: "OM", 巴林: "BH", 澳大利亚: "AU", 英国: "GB", 德国: "DE", 法国: "FR", 意大利: "IT",
  西班牙: "ES", 荷兰: "NL", 比利时: "BE", 日本: "JP", 韩国: "KR",
};

export async function GET(request: NextRequest) {
  const now = new Date();
  const latestClosedMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 3, 1));
  const defaultMonth = `${latestClosedMonth.getUTCFullYear()}-${String(latestClosedMonth.getUTCMonth() + 1).padStart(2, "0")}`;
  const marketRaw = request.nextUrl.searchParams.get("market") || "美国";
  const market = MARKET_ISO[marketRaw] || marketRaw;
  const product = request.nextUrl.searchParams.get("product") || "龙头及阀类";
  const flow = request.nextUrl.searchParams.get("flow") === "出口" ? "export" : "import";
  const granularity = request.nextUrl.searchParams.get("granularity") === "annual" ? "annual" : "monthly";
  const requestedRange = Number(request.nextUrl.searchParams.get("range") || (granularity === "monthly" ? 12 : 5));
  const explicitMonths = (request.nextUrl.searchParams.get("months") || "").split(",").filter(month => /^20\d{2}-(0[1-9]|1[0-2])$/.test(month)).slice(0, 36);

  const engine = createQueryEngine({
    db: env.DB,
    apiKey: process.env.COMTRADE_API_KEY,
    budget: new FixedBudget(0),
    cache: new D1CacheAdapter("comtrade", CACHE_TTL_MS, CACHE_TTL_MS),
  });
  const result = await engine.execute({
    intent: "trade_trend",
    subject: product,
    market,
    period: explicitMonths.at(-1) || defaultMonth,
    flow,
    granularity,
    range: requestedRange,
    months: explicitMonths,
  });
  if (result.status === "failed") {
    return NextResponse.json({ error: "官方数据暂时不可用", detail: result.reason }, { status: 502 });
  }
  const data = result.data?.kind === "trade" ? result.data.metric : null;
  if (!data) return NextResponse.json({ error: "官方数据暂时不可用" }, { status: 502 });
  return NextResponse.json({
    ...data,
    cache: {
      hit: result.cached,
      storage: result.metadata.cacheStorage || (result.cached ? "database" : "upstream"),
      storedAt: result.metadata.cacheStoredAt || data.fetchedAt,
      expiresAt: result.metadata.cacheExpiresAt || new Date(Date.now() + CACHE_TTL_MS).toISOString(),
      ttlSeconds: CACHE_TTL_MS / 1000,
    },
    query: { queryId: result.queryId, intent: result.intent, source: result.source, cost: result.cost },
  });
}
