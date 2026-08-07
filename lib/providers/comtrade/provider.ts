import type { Provider } from "../types.ts";
import { comtradeCapability } from "../mock/capabilities.ts";
import type { QueryRequest, TradeFlow } from "../../query/types.ts";
import { resolveProduct } from "../../products/resolver.ts";

export const REPORTERS: Record<string, number> = {
  "美国": 842, "加拿大": 124, "阿联酋": 784,
  "沙特阿拉伯": 682, "卡塔尔": 634, "科威特": 414, "阿曼": 512, "巴林": 48,
  "澳大利亚": 36, "中国": 156, "英国": 826, "德国": 276, "法国": 251,
  "意大利": 381, "西班牙": 724, "荷兰": 528, "比利时": 56, "日本": 392, "韩国": 410,
};

export function commodityHsCode(subject: string): string {
  const category = resolveProduct(subject);
  if (!category) return "";
  return category.defaultHsCode.replace(".", "");
}

const COUNTRY_ZH: Record<string, string> = { China: "中国", Mexico: "墨西哥", Germany: "德国", Japan: "日本", Canada: "加拿大", Italy: "意大利", "United Kingdom": "英国", "Rep. of Korea": "韩国", "Viet Nam": "越南", "Türkiye": "土耳其", Thailand: "泰国", India: "印度", France: "法国", Spain: "西班牙", Switzerland: "瑞士", "United Arab Emirates": "阿联酋" };

const countryFlag = (alpha2?: string) => alpha2 && /^[A-Z]{2}$/.test(alpha2) ? [...alpha2].map(letter => String.fromCodePoint(127397 + letter.charCodeAt(0))).join("") : "🌐";
const monthPeriod = (date: Date) => `${date.getUTCFullYear()}${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
const rollingMonths = (end: Date, length: number) => Array.from({ length }, (_, index) => {
  const date = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth() - (length - 1 - index), 1));
  return monthPeriod(date);
});

export interface ComtradeFetchOptions {
  apiKey?: string;
  fetchFn?: typeof fetch;
}

type ComtradeRow = { period?: string; primaryValue?: string | number; netWgt?: string | number; isNetWgtEstimated?: boolean | number; cmdCode?: string; partnerCode?: string | number; isReported?: boolean; isAggregate?: boolean };

export interface ComtradeView {
  source: string;
  sourceUrl: string;
  access: string;
  market: string;
  product: string;
  flow: string;
  granularity: string;
  range: number;
  availabilityStatus: "available" | "fallback" | "not_released" | "no_trade_record";
  requestedPeriod: string;
  period: string;
  latestReportedPeriod: string;
  recordCount: number;
  hsCode: string;
  tradeValue: number;
  netWeightKg: number;
  isNetWeightEstimated: boolean;
  series: Array<{ period: string; label: string; tradeValue: number; netWeightKg: number; isEstimated: boolean }>;
  partners: Array<{ code: number; iso2: string; name: string; englishName?: string; flag: string; value: number; share: number; netWeightKg: number; isEstimated: boolean }>;
  fetchedAt: string;
  licenseNote: string;
}

export class ComtradeProvider implements Provider {
  readonly capability = comtradeCapability;
  private readonly apiKey: string | undefined;
  private readonly fetchFn: typeof fetch;

  constructor(options: ComtradeFetchOptions = {}) {
    this.apiKey = options.apiKey;
    this.fetchFn = options.fetchFn || fetch;
  }

  async fetch(query: QueryRequest): Promise<ComtradeView> {
    const reporterCode = REPORTERS[query.market];
    const cmdCode = commodityHsCode(query.subject);
    if (!reporterCode || !cmdCode) throw new Error("该市场的官方接口正在准备中");

    const now = new Date();
    const latestClosedMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 3, 1));
    const defaultMonth = `${latestClosedMonth.getUTCFullYear()}-${String(latestClosedMonth.getUTCMonth() + 1).padStart(2, "0")}`;
    const flow: TradeFlow = query.flow || "import";
    const flowCode = flow === "export" ? "X" : "M";
    const granularity = query.granularity || "monthly";
    const requestedRangeInput = query.range || 12;
    const requestedRange = granularity === "monthly" ? ([1, 12, 24].includes(requestedRangeInput) ? requestedRangeInput : 12) : (requestedRangeInput === 10 ? 10 : 5);
    const explicitMonths = (query.months || []).filter(month => /^20\d{2}-(0[1-9]|1[0-2])$/.test(month)).slice(0, 36);
    const selectedMonth = /^20\d{2}-(0[1-9]|1[0-2])$/.test(query.period) ? query.period : defaultMonth;

    const key = this.apiKey;
    const frequency = granularity === "monthly" ? "M" : "A";
    const latestAvailableYear = granularity === "annual" ? now.getUTCFullYear() - 1 : latestClosedMonth.getUTCFullYear();
    const latestAvailableMonth = latestClosedMonth.getUTCMonth();
    const requestedPeriods = explicitMonths.length
      ? [...new Set(explicitMonths.map(month => month.replace("-", "")))].sort()
      : granularity === "monthly"
      ? requestedRange === 1 ? [selectedMonth.replace("-", "")] : rollingMonths(new Date(Date.UTC(latestAvailableYear, latestAvailableMonth, 1)), requestedRange)
      : Array.from({ length: requestedRange }, (_, index) => String(latestAvailableYear - (requestedRange - 1 - index)));
    const base = key ? `https://comtradeapi.un.org/data/v1/get/C/${frequency}/HS` : `https://comtradeapi.un.org/public/v1/preview/C/${frequency}/HS`;

    const fetchRows = async (queryPeriods: string[], commodity = cmdCode, partnerCode = "0") => {
      const chunks = Array.from({ length: Math.ceil(queryPeriods.length / 12) }, (_, index) => queryPeriods.slice(index * 12, index * 12 + 12));
      const records: Array<Record<string, unknown>> = [];
      for (const chunk of chunks) {
        const params = new URLSearchParams({ flowCode, reporterCode: String(reporterCode), period: chunk.join(","), partnerCode, cmdCode: commodity, partner2Code: "0", customsCode: "C00", motCode: "0", maxRecords: "500" });
        if (key) params.set("subscription-key", key);
        const response = await this.fetchFn(`${base}?${params}`, { headers: { Accept: "application/json" } });
        if (!response.ok) throw new Error(`Comtrade ${response.status}`);
        const payload = await response.json() as { data?: Array<Record<string, unknown>>; error?: string };
        if (payload.error) throw new Error(payload.error);
        records.push(...(payload.data || []));
      }
      return records as ComtradeRow[];
    };

    let displayPeriods = requestedPeriods;
    let rows = await fetchRows(displayPeriods);
    let latestKnownPeriod = rows.length ? String(rows.reduce((latest, row) => String(row.period) > latest ? String(row.period) : latest, "")) : "";
    let availabilityStatus: "available" | "fallback" | "not_released" | "no_trade_record" = "available";

    if (granularity === "monthly" && requestedRange !== 1 && !explicitMonths.length) {
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
        displayPeriods = rollingMonths(latestDate, requestedRange);
        rows = await fetchRows(displayPeriods);
        availabilityStatus = "fallback";
      }
    }

    if (granularity === "monthly" && (requestedRange === 1 || explicitMonths.length) && !rows.length) {
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
      return {
        source: "UN Comtrade", sourceUrl: "https://comtradeplus.un.org/", access: key ? "Free API" : "Public Preview API",
        market: query.market, product: query.subject, flow: flowCode, granularity, range: requestedPeriods.length, availabilityStatus,
        requestedPeriod: requestedPeriods.join(", "),
        period: "", latestReportedPeriod: latestKnownPeriod, recordCount: 0, hsCode: cmdCode,
        tradeValue: 0, netWeightKg: 0, series: [], partners: [], isNetWeightEstimated: false,
        fetchedAt: new Date().toISOString(), licenseNote: "Official public trade statistics; no substitute data used.",
      };
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
    const partnerParams = new URLSearchParams({ flowCode, reporterCode: String(reporterCode), period: String(latest.period), cmdCode, partner2Code: "0", customsCode: "C00", motCode: "0", maxRecords: "500" });
    if (key) partnerParams.set("subscription-key", key);
    const [partnerResponse, referenceResponse] = await Promise.all([
      this.fetchFn(`${base}?${partnerParams}`, { headers: { Accept: "application/json" } }),
      this.fetchFn("https://comtradeapi.un.org/files/v1/app/reference/partnerAreas.json", {}),
    ]);
    const partnerPayload = partnerResponse.ok ? await partnerResponse.json() as { data?: Array<ComtradeRow> } : { data: [] };
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

    return {
      source: "UN Comtrade", sourceUrl: "https://comtradeplus.un.org/", access: key ? "Free API" : "Public Preview API",
      market: query.market, product: query.subject, flow: flowCode, granularity, range: requestedPeriods.length, availabilityStatus, requestedPeriod: requestedPeriods.join(", "), period: actualPeriod,
      latestReportedPeriod: String(latest.period), recordCount: series.length,
      hsCode: String(latest.cmdCode || cmdCode), tradeValue, netWeightKg, series, partners,
      isNetWeightEstimated: series.some(point => point.isEstimated),
      fetchedAt: new Date().toISOString(), licenseNote: "Official public trade statistics; attribution retained.",
    };
  }
}
