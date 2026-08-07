import { NextRequest, NextResponse } from "next/server";
import { env } from "cloudflare:workers";

const CACHE_TTL_MS = 5 * 60 * 1000;
const memoryCache = new Map<string, { expiresAt: number; payload: Record<string, unknown> }>();

async function readCache(cacheKey: string) {
  try {
    if (!env.DB) throw new Error("D1 unavailable");
    await env.DB.prepare("CREATE TABLE IF NOT EXISTS trade_cache (cache_key TEXT PRIMARY KEY, payload TEXT NOT NULL, fetched_at INTEGER NOT NULL, expires_at INTEGER NOT NULL)").run();
    const row = await env.DB.prepare("SELECT payload, fetched_at, expires_at FROM trade_cache WHERE cache_key = ? AND expires_at > ?").bind(cacheKey, Date.now()).first<{ payload: string; fetched_at: number; expires_at: number }>();
    if (!row) return null;
    return { payload: JSON.parse(row.payload) as Record<string, unknown>, storedAt: row.fetched_at, expiresAt: row.expires_at, storage: "D1" };
  } catch {
    const row = memoryCache.get(cacheKey);
    if (!row || row.expiresAt <= Date.now()) return null;
    return { payload: row.payload, storedAt: row.expiresAt - CACHE_TTL_MS, expiresAt: row.expiresAt, storage: "memory" };
  }
}

async function writeCache(cacheKey: string, payload: Record<string, unknown>) {
  const now = Date.now();
  const expiresAt = now + CACHE_TTL_MS;
  memoryCache.set(cacheKey, { payload, expiresAt });
  try {
    if (!env.DB) return "memory";
    await env.DB.prepare("CREATE TABLE IF NOT EXISTS trade_cache (cache_key TEXT PRIMARY KEY, payload TEXT NOT NULL, fetched_at INTEGER NOT NULL, expires_at INTEGER NOT NULL)").run();
    await env.DB.prepare("INSERT INTO trade_cache (cache_key, payload, fetched_at, expires_at) VALUES (?, ?, ?, ?) ON CONFLICT(cache_key) DO UPDATE SET payload=excluded.payload, fetched_at=excluded.fetched_at, expires_at=excluded.expires_at")
      .bind(cacheKey, JSON.stringify(payload), now, expiresAt).run();
    return "D1";
  } catch {
    return "memory";
  }
}

const REPORTERS: Record<string, number> = {
  "美国": 842, "加拿大": 124, "阿联酋": 784,
  "沙特阿拉伯": 682, "卡塔尔": 634, "科威特": 414, "阿曼": 512, "巴林": 48,
  "澳大利亚": 36, "中国": 156, "英国": 826, "德国": 276, "法国": 251,
  "意大利": 381, "西班牙": 724, "荷兰": 528, "比利时": 56, "日本": 392, "韩国": 410,
};
const COMMODITIES: Record<string, string> = {
  "龙头及阀类": "848180",
  "龙头阀门零件": "848190",
  "塑料浴缸及淋浴盆": "392210",
  "瓷制陶瓷洁具": "691010",
  "其他陶瓷洁具": "691090",
  "钢铁卫浴制品": "732490",
  "铜制卫浴制品": "741820",
};
const COUNTRY_ZH: Record<string, string> = { China: "中国", Mexico: "墨西哥", Germany: "德国", Japan: "日本", Canada: "加拿大", Italy: "意大利", "United Kingdom": "英国", "Rep. of Korea": "韩国", "Viet Nam": "越南", "Türkiye": "土耳其", Thailand: "泰国", India: "印度", France: "法国", Spain: "西班牙", Switzerland: "瑞士", "United Arab Emirates": "阿联酋" };
const countryFlag = (alpha2?: string) => alpha2 && /^[A-Z]{2}$/.test(alpha2) ? [...alpha2].map(letter => String.fromCodePoint(127397 + letter.charCodeAt(0))).join("") : "🌐";
const monthPeriod = (date: Date) => `${date.getUTCFullYear()}${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
const rollingMonths = (end: Date, length: number) => Array.from({ length }, (_, index) => {
  const date = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth() - (length - 1 - index), 1));
  return monthPeriod(date);
});

export async function GET(request: NextRequest) {
  const now = new Date();
  // Official customs statistics are normally released with a reporting lag.
  // Querying through three months ago avoids treating unpublished months as zero.
  const latestClosedMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 3, 1));
  const defaultMonth = `${latestClosedMonth.getUTCFullYear()}-${String(latestClosedMonth.getUTCMonth() + 1).padStart(2, "0")}`;
  const market = request.nextUrl.searchParams.get("market") || "美国";
  const requestedProduct = request.nextUrl.searchParams.get("product") || "龙头及阀类";
  const product = ["花洒", "水龙头", "淋浴系统", "卫浴阀门"].includes(requestedProduct) ? "龙头及阀类" : requestedProduct;
  const flow = request.nextUrl.searchParams.get("flow") === "出口" ? "X" : "M";
  const explicitMonths = (request.nextUrl.searchParams.get("months") || "").split(",").filter(month => /^20\d{2}-(0[1-9]|1[0-2])$/.test(month)).slice(0, 36);
  const granularity = explicitMonths.length ? "monthly" : request.nextUrl.searchParams.get("granularity") === "annual" ? "annual" : "monthly";
  const requestedRange = Number(request.nextUrl.searchParams.get("range") || (granularity === "monthly" ? 12 : 5));
  const range = granularity === "monthly" ? ([1, 12, 24].includes(requestedRange) ? requestedRange : 12) : (requestedRange === 10 ? 10 : 5);
  const requestedMonth = request.nextUrl.searchParams.get("month") || defaultMonth;
  const selectedMonth = /^20\d{2}-(0[1-9]|1[0-2])$/.test(requestedMonth) ? requestedMonth : defaultMonth;
  const reporterCode = REPORTERS[market];
  const cmdCode = COMMODITIES[product];
  if (!reporterCode || !cmdCode) return NextResponse.json({ error: "该市场的官方接口正在准备中" }, { status: 422 });

  const cacheKey = ["v5-explicit-months", market, product, flow, granularity, explicitMonths.join(",") || `${range}|${selectedMonth}`].join("|");
  const cached = await readCache(cacheKey);
  if (cached) {
    return NextResponse.json({ ...cached.payload, cache: { hit: true, storage: cached.storage, storedAt: new Date(cached.storedAt).toISOString(), expiresAt: new Date(cached.expiresAt).toISOString(), ttlSeconds: CACHE_TTL_MS / 1000 } });
  }

  const key = process.env.COMTRADE_API_KEY;
  const frequency = granularity === "monthly" ? "M" : "A";
  const latestAvailableYear = granularity === "annual" ? now.getUTCFullYear() - 1 : latestClosedMonth.getUTCFullYear();
  const latestAvailableMonth = latestClosedMonth.getUTCMonth();
  const requestedPeriods = explicitMonths.length
    ? [...new Set(explicitMonths.map(month => month.replace("-", "")))].sort()
    : granularity === "monthly"
    ? range === 1 ? [selectedMonth.replace("-", "")] : rollingMonths(new Date(Date.UTC(latestAvailableYear, latestAvailableMonth, 1)), range)
    : Array.from({ length: range }, (_, index) => String(latestAvailableYear - (range - 1 - index)));
  const base = key ? `https://comtradeapi.un.org/data/v1/get/C/${frequency}/HS` : `https://comtradeapi.un.org/public/v1/preview/C/${frequency}/HS`;

  try {
    const fetchRows = async (queryPeriods: string[], commodity = cmdCode, partnerCode = "0") => {
      const chunks = Array.from({ length: Math.ceil(queryPeriods.length / 12) }, (_, index) => queryPeriods.slice(index * 12, index * 12 + 12));
      const records: Array<Record<string, unknown>> = [];
      for (const chunk of chunks) {
        const params = new URLSearchParams({ flowCode: flow, reporterCode: String(reporterCode), period: chunk.join(","), partnerCode, cmdCode: commodity, partner2Code: "0", customsCode: "C00", motCode: "0", maxRecords: "500" });
        if (key) params.set("subscription-key", key);
        const response = await fetch(`${base}?${params}`, { headers: { Accept: "application/json" }, next: { revalidate: 21600 } });
        if (!response.ok) throw new Error(`Comtrade ${response.status}`);
        const payload = await response.json() as { data?: Array<Record<string, unknown>>; error?: string };
        if (payload.error) throw new Error(payload.error);
        records.push(...(payload.data || []));
      }
      return records;
    };

    let displayPeriods = requestedPeriods;
    let rows = await fetchRows(displayPeriods);
    let latestKnownPeriod = rows.length ? String(rows.reduce((latest, row) => String(row.period) > latest ? String(row.period) : latest, "")) : "";
    let availabilityStatus: "available" | "fallback" | "not_released" | "no_trade_record" = "available";

    if (granularity === "monthly" && range !== 1 && !explicitMonths.length) {
      if (!latestKnownPeriod) {
        const requestedStart = requestedPeriods[0];
        const startDate = new Date(Date.UTC(Number(requestedStart.slice(0, 4)), Number(requestedStart.slice(4, 6)) - 2, 1));
        for (let offset = 0; offset < 5 && !latestKnownPeriod; offset += 1) {
          const probeEnd = new Date(Date.UTC(startDate.getUTCFullYear(), startDate.getUTCMonth() - offset * 12, 1));
          const probeRows = await fetchRows(rollingMonths(probeEnd, 12));
          if (probeRows.length) latestKnownPeriod = String(probeRows.reduce((latest, row) => String(row.period) > latest ? String(row.period) : latest, ""));
        }
      }
      if (latestKnownPeriod && latestKnownPeriod !== requestedPeriods.at(-1)) {
        const latestDate = new Date(Date.UTC(Number(latestKnownPeriod.slice(0, 4)), Number(latestKnownPeriod.slice(4, 6)) - 1, 1));
        displayPeriods = rollingMonths(latestDate, range);
        rows = await fetchRows(displayPeriods);
        availabilityStatus = "fallback";
      }
    }

    if (granularity === "monthly" && (range === 1 || explicitMonths.length) && !rows.length) {
      const totalRows = await fetchRows(requestedPeriods, "TOTAL");
      availabilityStatus = totalRows.length ? "no_trade_record" : "not_released";
      const selectedDate = new Date(Date.UTC(Number(requestedPeriods[0].slice(0, 4)), Number(requestedPeriods[0].slice(4, 6)) - 2, 1));
      for (let offset = 0; offset < 5 && !latestKnownPeriod; offset += 1) {
        const probeEnd = new Date(Date.UTC(selectedDate.getUTCFullYear(), selectedDate.getUTCMonth() - offset * 12, 1));
        const probeRows = await fetchRows(rollingMonths(probeEnd, 12));
        if (probeRows.length) latestKnownPeriod = String(probeRows.reduce((latest, row) => String(row.period) > latest ? String(row.period) : latest, ""));
      }
    }

    if (!rows.length) {
      const emptyResult = {
        source: "UN Comtrade", sourceUrl: "https://comtradeplus.un.org/", access: key ? "Free API" : "Public Preview API",
        market, product, flow, granularity, range, availabilityStatus,
        requestedPeriod: requestedPeriods.join(", "),
        period: "", latestReportedPeriod: latestKnownPeriod, recordCount: 0, hsCode: cmdCode,
        tradeValue: 0, netWeightKg: 0, series: [], partners: [], isNetWeightEstimated: false,
        fetchedAt: new Date().toISOString(), licenseNote: "Official public trade statistics; no substitute data used.",
      };
      const cacheStorage = await writeCache(cacheKey, emptyResult);
      return NextResponse.json({ ...emptyResult, cache: { hit: false, storage: cacheStorage, storedAt: emptyResult.fetchedAt, expiresAt: new Date(Date.now() + CACHE_TTL_MS).toISOString(), ttlSeconds: CACHE_TTL_MS / 1000 } });
    }

    const sortedRows = rows.sort((a, b) => String(a.period).localeCompare(String(b.period)));
    const series = sortedRows.map(row => ({
      period: String(row.period),
      label: granularity === "monthly" ? `${String(row.period).slice(2, 4)}.${String(row.period).slice(4, 6)}` : String(row.period),
      tradeValue: Number(row.primaryValue || 0),
      netWeightKg: Number(row.netWgt || 0),
      isEstimated: Boolean(row.isNetWgtEstimated),
    }));
    const tradeValue = series.reduce((total, point) => total + point.tradeValue, 0);
    const netWeightKg = series.reduce((total, point) => total + point.netWeightKg, 0);
    const latest = sortedRows[sortedRows.length - 1];
    const actualPeriod = `${series[0].period}–${series[series.length - 1].period}`;
    const partnerParams = new URLSearchParams({ flowCode: flow, reporterCode: String(reporterCode), period: String(latest.period), cmdCode, partner2Code: "0", customsCode: "C00", motCode: "0", maxRecords: "500" });
    if (key) partnerParams.set("subscription-key", key);
    const [partnerResponse, referenceResponse] = await Promise.all([
      fetch(`${base}?${partnerParams}`, { headers: { Accept: "application/json" }, next: { revalidate: 21600 } }),
      fetch("https://comtradeapi.un.org/files/v1/app/reference/partnerAreas.json", { next: { revalidate: 86400 } }),
    ]);
    const partnerPayload = partnerResponse.ok ? await partnerResponse.json() as { data?: Array<Record<string, unknown>> } : { data: [] };
    const referencePayload = referenceResponse.ok ? await referenceResponse.json() as { results?: Array<{ PartnerCode: number; PartnerDesc: string; PartnerCodeIsoAlpha2?: string }> } : { results: [] };
    const partnerReferences = new Map((referencePayload.results || []).map(item => [item.PartnerCode, item]));
    const partnerRows = (partnerPayload.data || []).filter(row => Number(row.partnerCode) !== 0 && Number(row.primaryValue || 0) > 0);
    const latestWorldValue = Number((partnerPayload.data || []).find(row => Number(row.partnerCode) === 0)?.primaryValue || 0);
    const partners = partnerRows.sort((a, b) => Number(b.primaryValue || 0) - Number(a.primaryValue || 0)).slice(0, 30).map(row => {
      const reference = partnerReferences.get(Number(row.partnerCode));
      const englishName = reference?.PartnerDesc || `Partner ${row.partnerCode}`;
      const value = Number(row.primaryValue || 0);
      return { code: Number(row.partnerCode), iso2: reference?.PartnerCodeIsoAlpha2 || "", name: COUNTRY_ZH[englishName] || englishName, englishName, flag: countryFlag(reference?.PartnerCodeIsoAlpha2), value, share: latestWorldValue ? value / latestWorldValue * 100 : 0, netWeightKg: Number(row.netWgt || 0), isEstimated: Boolean(row.isNetWgtEstimated) };
    });
    const result = {
      source: "UN Comtrade", sourceUrl: "https://comtradeplus.un.org/", access: key ? "Free API" : "Public Preview API",
      market, product, flow, granularity, range: requestedPeriods.length, availabilityStatus, requestedPeriod: requestedPeriods.join(", "), period: actualPeriod,
      latestReportedPeriod: String(latest.period), recordCount: series.length,
      hsCode: latest.cmdCode, tradeValue, netWeightKg, series, partners,
      isNetWeightEstimated: series.some(point => point.isEstimated), isReported: latest.isReported, isAggregate: latest.isAggregate,
      fetchedAt: new Date().toISOString(), licenseNote: "Official public trade statistics; attribution retained.",
    };
    const cacheStorage = await writeCache(cacheKey, result);
    return NextResponse.json({ ...result, cache: { hit: false, storage: cacheStorage, storedAt: result.fetchedAt, expiresAt: new Date(Date.now() + CACHE_TTL_MS).toISOString(), ttlSeconds: CACHE_TTL_MS / 1000 } });
  } catch (error) {
    return NextResponse.json({ error: "官方数据暂时不可用", detail: error instanceof Error ? error.message : "Unknown error" }, { status: 502 });
  }
}
