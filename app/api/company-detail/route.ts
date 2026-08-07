import { NextRequest,NextResponse } from "next/server";
import { env } from "cloudflare:workers";

export async function GET(request:NextRequest){
  if(!env.DB)return NextResponse.json({error:"Database unavailable"},{status:503});
  const id=request.nextUrl.searchParams.get("id")||"";
  const company=await env.DB.prepare("SELECT id,entity_type,name,address,country,country_code,admin1_code,admin1_name,city_name,location_names,location_precision,website,website_status,website_source_url,website_verified_at,chinese_name,marketplace_urls,total_shipments,latest_shipment_date,avg_teu_per_shipment,avg_teu_per_month,estimated_shipping_spend_usd,shipping_spend_coverage_percent,contact_data_status,source_url,source_attribution,captured_at FROM importyeti_web_entities WHERE id=?").bind(id).first<Record<string,unknown>>();
  if(!company)return NextResponse.json({error:"Company not found"},{status:404});
  const importer=company.entity_type==="importer";
  const relations=importer
    ? await env.DB.prepare(`SELECT r.id,r.shipment_count,r.period_start,r.period_end,r.hs_codes,r.product_descriptions,r.discovery_direction,r.evidence_status,s.id company_id,s.name company_name,s.address company_address,s.country company_country,s.country_code company_country_code,s.admin1_name company_admin1_name,s.city_name company_city_name,s.location_names company_location_names,s.location_precision company_location_precision,s.website,s.total_shipments,s.latest_shipment_date,s.source_url,
        COUNT(DISTINCT sh.id) captured_bols,COALESCE(SUM(sh.weight_kg),0) captured_weight_kg,COALESCE(SUM(sh.container_count),0) captured_containers,COALESCE(SUM(CAST(sh.estimated_freight_usd AS REAL)),0) captured_freight_usd
      FROM importyeti_web_relationships r JOIN importyeti_web_entities s ON s.id=r.supplier_id
      LEFT JOIN importyeti_web_shipments sh ON sh.supplier_id=s.id AND sh.importer_id=r.importer_id
      WHERE r.importer_id=? GROUP BY r.id ORDER BY r.shipment_count DESC`).bind(id).all()
    : await env.DB.prepare(`SELECT r.id,r.shipment_count,r.period_start,r.period_end,r.hs_codes,r.product_descriptions,r.discovery_direction,r.evidence_status,i.id company_id,i.name company_name,i.address company_address,i.country company_country,i.country_code company_country_code,i.admin1_name company_admin1_name,i.city_name company_city_name,i.location_names company_location_names,i.location_precision company_location_precision,i.website,i.total_shipments,i.latest_shipment_date,i.source_url,
        COUNT(DISTINCT sh.id) captured_bols,COALESCE(SUM(sh.weight_kg),0) captured_weight_kg,COALESCE(SUM(sh.container_count),0) captured_containers,COALESCE(SUM(CAST(sh.estimated_freight_usd AS REAL)),0) captured_freight_usd
      FROM importyeti_web_relationships r JOIN importyeti_web_entities i ON i.id=r.importer_id
      LEFT JOIN importyeti_web_shipments sh ON sh.supplier_id=? AND sh.importer_id=i.id
      WHERE r.supplier_id=? GROUP BY r.id ORDER BY r.shipment_count DESC`).bind(id,id).all();
  const monthly=importer?await env.DB.prepare(`SELECT substr(sh.shipment_date,1,7) month,sh.supplier_id counterparty_id,s.name counterparty_name,s.country counterparty_country,sh.supplier_id supplier_id,s.name supplier_name,s.country supplier_country,
      COUNT(DISTINCT sh.id) shipments,COALESCE(SUM(sh.weight_kg),0) weight_kg,COALESCE(SUM(sh.container_count),0) containers,
      COALESCE(SUM(CAST(sh.estimated_freight_usd AS REAL)),0) estimated_freight_usd,COUNT(sh.estimated_freight_usd) freight_covered_shipments,
      GROUP_CONCAT(DISTINCT sh.product_description) products
    FROM importyeti_web_shipments sh JOIN importyeti_web_entities s ON s.id=sh.supplier_id
    WHERE sh.importer_id=? GROUP BY month,sh.supplier_id ORDER BY month DESC,shipments DESC`).bind(id).all()
    :await env.DB.prepare(`SELECT substr(sh.shipment_date,1,7) month,sh.importer_id counterparty_id,i.name counterparty_name,i.country counterparty_country,sh.importer_id supplier_id,i.name supplier_name,i.country supplier_country,
      COUNT(DISTINCT sh.id) shipments,COALESCE(SUM(sh.weight_kg),0) weight_kg,COALESCE(SUM(sh.container_count),0) containers,
      COALESCE(SUM(CAST(sh.estimated_freight_usd AS REAL)),0) estimated_freight_usd,COUNT(sh.estimated_freight_usd) freight_covered_shipments,
      GROUP_CONCAT(DISTINCT sh.product_description) products
    FROM importyeti_web_shipments sh JOIN importyeti_web_entities i ON i.id=sh.importer_id
    WHERE sh.supplier_id=? GROUP BY month,sh.importer_id ORDER BY month DESC,shipments DESC`).bind(id).all();
  return NextResponse.json({company,relationshipRole:importer?"upstream_suppliers":"downstream_importers",relationships:relations.results,monthlyBreakdown:monthly.results,dataset:"importyeti_free_web",scope:"All stored relationships for this company; not restricted by the search category."});
}
