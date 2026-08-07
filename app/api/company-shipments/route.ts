import { NextRequest,NextResponse } from "next/server";
import { env } from "cloudflare:workers";
import { enrichShipmentRow } from "../../../lib/entities/shipment.ts";

export async function GET(request:NextRequest){
  if(!env.DB)return NextResponse.json({error:"Database unavailable"},{status:503});
  const companyId=request.nextUrl.searchParams.get("companyId")||"";
  const page=Math.max(1,Number(request.nextUrl.searchParams.get("page")||1));
  const pageSize=Math.min(50,Math.max(10,Number(request.nextUrl.searchParams.get("pageSize")||20)));
  const month=request.nextUrl.searchParams.get("month")||"";
  const company=await env.DB.prepare("SELECT id,entity_type FROM importyeti_web_entities WHERE id=?").bind(companyId).first<{id:string;entity_type:string}>();
  if(!company)return NextResponse.json({error:"Company not found"},{status:404});
  const field=company.entity_type==="supplier"?"sh.supplier_id":"sh.importer_id";
  const monthClause=month?" AND substr(sh.shipment_date,1,7)=?":"";
  const binds=month?[companyId,month]:[companyId];
  const count=await env.DB.prepare(`SELECT COUNT(*) total FROM importyeti_web_shipments sh WHERE ${field}=?${monthClause}`).bind(...binds).first<{total:number}>();
  const result=await env.DB.prepare(`SELECT sh.id,sh.shipment_date,sh.date_basis,sh.actual_arrival_date,sh.house_bol,sh.master_bol,sh.weight_kg,sh.quantity,sh.quantity_unit,sh.container_count,sh.product_description,sh.estimated_freight_usd,sh.source_url,sh.captured_at,
    supplier.id supplier_id,supplier.name supplier_name,supplier.country supplier_country,importer.id importer_id,importer.name importer_name,importer.country importer_country
    FROM importyeti_web_shipments sh
    LEFT JOIN importyeti_web_entities supplier ON supplier.id=sh.supplier_id
    LEFT JOIN importyeti_web_entities importer ON importer.id=sh.importer_id
    WHERE ${field}=?${monthClause} ORDER BY sh.shipment_date DESC,sh.id DESC LIMIT ? OFFSET ?`).bind(...binds,pageSize,(page-1)*pageSize).all();
  const months=await env.DB.prepare(`SELECT substr(sh.shipment_date,1,7) month,COUNT(*) shipments FROM importyeti_web_shipments sh WHERE ${field}=? GROUP BY 1 ORDER BY 1 DESC`).bind(companyId).all();
  const shipments = (result.results || []).map(row => enrichShipmentRow(row as Record<string, unknown>));
  return NextResponse.json({companyId,page,pageSize,total:Number(count?.total||0),totalPages:Math.max(1,Math.ceil(Number(count?.total||0)/pageSize)),month,months:months.results,shipments});
}
