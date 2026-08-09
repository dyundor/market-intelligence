import { NextRequest, NextResponse } from "next/server";
import { env } from "cloudflare:workers";
import { aggregateProductBuyers, enrichProductBuyers, type ProductShipmentEvidence, SALES_PRODUCTS } from "../../../../lib/products/hot-products.ts";

export async function GET(request: NextRequest) {
  if (!env.DB) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });

  const productId = request.nextUrl.searchParams.get("product_id") || "";

  const product = SALES_PRODUCTS.find(p => p.id === productId);
  if (!product) return NextResponse.json({ error: "Unknown product" }, { status: 400 });

  const shResult = await env.DB.prepare(
    `SELECT sh.id, sh.importer_id, COALESCE(sh.importer_name, e.name) importer_name,
            sh.product_description, sh.shipment_date, sh.weight_kg
     FROM importyeti_web_shipments sh
     LEFT JOIN importyeti_web_entities e ON e.id = sh.importer_id
     WHERE sh.product_description IS NOT NULL AND trim(sh.product_description) <> ''`
  ).all();
  const rows = (shResult.results || []) as unknown as ProductShipmentEvidence[];

  const aggregates = aggregateProductBuyers(rows, productId);

  const buyerIds = [...new Set(aggregates.map(a => a.importerId))];
  if (!buyerIds.length) {
    return NextResponse.json({
      productId, productName: product.name, productNameEn: product.nameEn,
      totalShipments: aggregates.reduce((s, a) => s + a.shipments, 0),
      totalBuyers: 0, buyers: [],
      scope: "Stored shipment evidence only; mixed-product shipments may support more than one product.",
    });
  }

  const placeholders = buyerIds.map(() => "?").join(",");

  const entityResult = await env.DB.prepare(
    `SELECT id, name, identity_status, identity_confidence, identity_notes,
            website, website_status, country
     FROM importyeti_web_entities WHERE id IN (${placeholders})`
  ).bind(...buyerIds).all();
  const entities = (entityResult.results || []) as unknown as Array<{
    id: string; name: string; identity_status: string | null; identity_confidence: number | null;
    identity_notes: string | null; website: string | null; website_status: string | null; country: string | null;
  }>;

  const watchlistResult = await env.DB.prepare(
    `SELECT company_id, lead_status, outreach_strategy, commercial_fit_score, outreach_score, recommended_products
     FROM buyer_watchlist WHERE company_id IN (${placeholders})`
  ).bind(...buyerIds).all();
  const watchlist = (watchlistResult.results || []) as unknown as Array<{
    company_id: string; lead_status: string | null; outreach_strategy: string | null;
    commercial_fit_score: number | null; outreach_score: number | null; recommended_products: string | null;
  }>;

  const contactResult = await env.DB.prepare(
    `SELECT DISTINCT company_id FROM lead_contacts
     WHERE company_id IN (${placeholders}) AND verification_status = 'verified'`
  ).bind(...buyerIds).all();
  const verifiedContacts = new Set(((contactResult.results || []) as Array<{ company_id: string }>).map(r => r.company_id));

  const buyers = enrichProductBuyers(aggregates, entities, watchlist, verifiedContacts);

  return NextResponse.json({
    productId, productName: product.name, productNameEn: product.nameEn,
    totalShipments: aggregates.reduce((s, a) => s + a.shipments, 0),
    totalBuyers: buyers.length, buyers,
    scope: "Stored shipment evidence only; mixed-product shipments may support more than one product.",
  });
}
