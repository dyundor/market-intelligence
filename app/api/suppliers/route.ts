import { NextRequest, NextResponse } from "next/server";
import { cachedApiRequest, canonicalCacheKey } from "../_shared/paid-cache";

type Trader = { TraderId: number; CompanyName?: string; Address1?: string; Address2?: string; Address3?: string; Address4?: string; Address5?: string; PostCode?: string };
type ExportRow = { TraderId: number; CommodityId: number; MonthId: number; Trader?: Trader };

const CACHE_MS = 60 * 60 * 1000;

export async function GET(request: NextRequest) {
  const market = request.nextUrl.searchParams.get("market") || "";
  const hsCode = request.nextUrl.searchParams.get("hsCode") || "";
  if (market !== "英国" || hsCode !== "848180") {
    return NextResponse.json({ available: false, reason: "当前类目暂无可自动查询的免费公司级官方数据。", suppliers: [] });
  }

  const params = new URLSearchParams({
    "$filter": "(CommodityId eq 84818011 or CommodityId eq 84818019) and MonthId eq 202401",
    "$expand": "Trader",
  });
  try {
    const result = await cachedApiRequest({provider:"hmrc",cacheKey:canonicalCacheKey("export",{codes:"84818011,84818019",month:"202401"}),ttlMs:CACHE_MS,staleTtlMs:7*24*60*60*1000,requirePersistent:false},async () => {
      const response = await fetch(`https://api.uktradeinfo.com/Export?${params}`, { headers: { Accept: "application/json" } });
      if (!response.ok) throw new Error(`HMRC ${response.status}`);
      const body = await response.json() as { value?: ExportRow[] };
      const companies = new Map<number, { traderId: number; name: string; address: string; postcode: string; commodityCodes: Set<string>; evidenceRecords: number }>();
      for (const row of body.value || []) {
        if (!row.Trader?.CompanyName) continue;
        const existing = companies.get(row.TraderId) || {traderId:row.TraderId,name:row.Trader.CompanyName.trim().replace(/\s+/g," "),address:[row.Trader.Address1,row.Trader.Address2,row.Trader.Address3,row.Trader.Address4,row.Trader.Address5].filter(Boolean).join(", ").replace(/\s+/g," "),postcode:row.Trader.PostCode || "",commodityCodes:new Set<string>(),evidenceRecords:0};
        existing.commodityCodes.add(String(row.CommodityId));
        existing.evidenceRecords += 1;
        companies.set(row.TraderId,existing);
      }
      const suppliers = [...companies.values()].map(item => ({...item,commodityCodes:[...item.commodityCodes]})).sort((a,b) => a.name.localeCompare(b.name));
      return {available:true,source:"HMRC UK Trade Info",sourceUrl:"https://www.uktradeinfo.com/api-documentation",evidenceType:"英国海关出口商记录",period:"202401",hsCode,cn8Codes:["84818011","84818019"],scopeNote:"企业名称和地址由 HMRC 公开接口返回；只能证明该企业在指定月份有相关出口记录，不证明其一定是制造商。",fetchedAt:new Date().toISOString(),suppliers};
    });
    return NextResponse.json({...result.value,cacheHit:result.cache.hit,cache:result.cache});
  } catch (error) {
    return NextResponse.json({ available: false, reason: "HMRC 公开接口暂时不可用。", detail: error instanceof Error ? error.message : "Unknown error", suppliers: [] }, { status: 502 });
  }
}
