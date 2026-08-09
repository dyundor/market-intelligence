import { computeConfidence, type DataConfidence } from "../data-confidence.ts";
import {
  type ProductShipmentEvidence,
  classifySalesProducts,
  SALES_PRODUCTS,
} from "./hot-products.ts";

export interface TrendPoint {
  month: string;
  shipments: number;
  buyers: number;
  weightKg: number;
  uniqueBuyerIds: string[];
  growthRate: number | null;
  confidence: DataConfidence;
}

export interface TrendMetric {
  productId: string;
  productName: string;
  points: TrendPoint[];
  summary: {
    totalShipments: number;
    totalBuyers: number;
    totalWeightKg: number;
    avgMonthlyGrowth: number;
    bestMonth: string;
    worstMonth: string;
    periodStart: string;
    periodEnd: string;
  };
}

export function computeGrowthRate(prev: number | null, current: number): number | null {
  if (prev === null || prev === 0) return null;
  return ((current - prev) / prev) * 100;
}

export function computeTrend(
  rows: ProductShipmentEvidence[],
  productId: string,
  months: number = 12,
): TrendMetric | null {
  const matched = rows.filter((row) => {
    const cats = classifySalesProducts(row.product_description || "");
    return cats.includes(productId);
  });
  if (matched.length === 0) return null;

  const productDef = SALES_PRODUCTS.find((p) => p.id === productId);

  interface MonthBucket {
    shipments: number;
    buyers: Set<string>;
    weightKg: number;
    mixedCount: number;
  }

  const monthMap = new Map<string, MonthBucket>();

  for (const row of matched) {
    const month = (row.shipment_date || "").slice(0, 7);
    if (month.length !== 7) continue;

    let bucket = monthMap.get(month);
    if (!bucket) {
      bucket = { shipments: 0, buyers: new Set(), weightKg: 0, mixedCount: 0 };
      monthMap.set(month, bucket);
    }
    bucket.shipments += 1;
    if (row.importer_id) bucket.buyers.add(row.importer_id);
    bucket.weightKg += Number(row.weight_kg || 0);
    const cats = classifySalesProducts(row.product_description || "");
    if (cats.length > 1) bucket.mixedCount += 1;
  }

  const sortedMonths = [...monthMap.keys()].sort();
  const limitedMonths = sortedMonths.slice(-months);

  const points: TrendPoint[] = [];
  let prevShipments: number | null = null;

  for (const month of limitedMonths) {
    const bucket = monthMap.get(month)!;
    const growthRate = computeGrowthRate(prevShipments, bucket.shipments);

    const confidence = computeConfidence({
      shipmentRecords: bucket.shipments,
      matchedRecords: bucket.shipments,
      mixedRecords: bucket.mixedCount,
      categories: 1,
      lastUpdated: month,
      dataSource: "stored_us_ocean_import_shipments",
    });

    points.push({
      month,
      shipments: bucket.shipments,
      buyers: bucket.buyers.size,
      weightKg: bucket.weightKg,
      uniqueBuyerIds: [...bucket.buyers],
      growthRate,
      confidence,
    });

    prevShipments = bucket.shipments;
  }

  const allBuyers = new Set<string>();
  for (const p of points) for (const id of p.uniqueBuyerIds) allBuyers.add(id);

  const totalShipments = points.reduce((s, p) => s + p.shipments, 0);
  const totalWeightKg = points.reduce((s, p) => s + p.weightKg, 0);
  const growthRates = points.filter((p) => p.growthRate !== null).map((p) => p.growthRate!);
  const avgMonthlyGrowth = growthRates.length > 0
    ? Math.round((growthRates.reduce((a, b) => a + b, 0) / growthRates.length) * 100) / 100
    : 0;

  const best = points.length > 0
    ? points.reduce((a, b) => (a.shipments > b.shipments ? a : b))
    : null;
  const worst = points.length > 0
    ? points.reduce((a, b) => (a.shipments < b.shipments ? a : b))
    : null;

  return {
    productId,
    productName: productDef?.nameEn ?? productId,
    points,
    summary: {
      totalShipments,
      totalBuyers: allBuyers.size,
      totalWeightKg,
      avgMonthlyGrowth,
      bestMonth: best?.month || "",
      worstMonth: worst?.month || "",
      periodStart: limitedMonths[0] || "",
      periodEnd: limitedMonths[limitedMonths.length - 1] || "",
    },
  };
}

export function aggregateMonthly(
  rows: ProductShipmentEvidence[],
  productId: string,
): TrendMetric | null {
  return computeTrend(rows, productId, 12);
}
