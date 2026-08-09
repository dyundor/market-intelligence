import { NextRequest, NextResponse } from "next/server";
import { env } from "cloudflare:workers";
import { computeTrend } from "../../../../lib/products/trend-metrics.ts";
import { SALES_PRODUCTS, type ProductShipmentEvidence } from "../../../../lib/products/hot-products.ts";

export async function GET(request: NextRequest) {
  if (!env.DB) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });

  const productId = request.nextUrl.searchParams.get("product_id") || "";

  if (!productId) return NextResponse.json({ error: "Missing product_id" }, { status: 400 });

  const product = SALES_PRODUCTS.find(p => p.id === productId);
  if (!product) return NextResponse.json({ error: "Unknown product" }, { status: 400 });

  let shResult;
  try {
    shResult = await env.DB.prepare(
      `SELECT sh.id, sh.importer_id, COALESCE(sh.importer_name, e.name) importer_name,
              sh.product_description, sh.shipment_date, sh.weight_kg
       FROM importyeti_web_shipments sh
       LEFT JOIN importyeti_web_entities e ON e.id = sh.importer_id
       WHERE sh.product_description IS NOT NULL AND trim(sh.product_description) <> ''`
    ).all();
  } catch {
    return NextResponse.json({ error: "Database unavailable" }, { status: 503 });
  }
  const rows = (shResult.results || []) as unknown as ProductShipmentEvidence[];

  const trend = computeTrend(rows, productId);
  if (!trend) return NextResponse.json({ error: "Unknown product" }, { status: 400 });

  return NextResponse.json(trend);
}
