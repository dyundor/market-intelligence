import { NextRequest, NextResponse } from "next/server";
import { env } from "cloudflare:workers";

export async function GET(request:NextRequest) {
  if (!env.DB) return NextResponse.json({error:"Database unavailable"},{status:503});
  const entityType = request.nextUrl.searchParams.get("type") || "";
  const query = (request.nextUrl.searchParams.get("q") || "").trim();
  const limit = Math.min(200,Math.max(1,Number(request.nextUrl.searchParams.get("limit") || 100)));
  const likeQuery = `%${query}%`;
  const [entitiesResult,relationshipsResult] = await Promise.all([
    env.DB.prepare("SELECT id, entity_type, name, address, country, website, total_shipments, latest_shipment_date, avg_teu_per_shipment, avg_teu_per_month, estimated_shipping_spend_usd, shipping_spend_coverage_percent, contact_data_status, source_url, source_channel, source_attribution, search_query, captured_at FROM importyeti_web_entities WHERE (? = '' OR entity_type = ?) AND (? = '' OR name LIKE ? OR address LIKE ?) ORDER BY COALESCE(total_shipments,0) DESC LIMIT ?")
      .bind(entityType,entityType,query,likeQuery,likeQuery,limit).all(),
    env.DB.prepare("SELECT r.id, r.supplier_id, supplier.name AS supplier_name, r.importer_id, importer.name AS importer_name, r.shipment_count, r.period_start, r.period_end, r.hs_codes, r.product_descriptions, r.source_url, r.source_channel, r.captured_at FROM importyeti_web_relationships r JOIN importyeti_web_entities supplier ON supplier.id=r.supplier_id JOIN importyeti_web_entities importer ON importer.id=r.importer_id WHERE (? = '' OR supplier.name LIKE ? OR importer.name LIKE ? OR r.product_descriptions LIKE ?) ORDER BY COALESCE(r.shipment_count,0) DESC LIMIT ?")
      .bind(query,likeQuery,likeQuery,likeQuery,limit).all(),
  ]);
  return NextResponse.json({
    dataset:"importyeti_free_web",
    isolation:"Stored separately from future ImportYeti API responses",
    entities:entitiesResult.results,
    relationships:relationshipsResult.results,
  });
}
