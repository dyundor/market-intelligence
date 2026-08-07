import { NextRequest,NextResponse } from "next/server";
import { env } from "cloudflare:workers";

export async function GET(request:NextRequest){
  if(!env.DB)return NextResponse.json({error:"Database unavailable"},{status:503});
  const id=request.nextUrl.searchParams.get("id")||"";
  const shipment=await env.DB.prepare(`SELECT sh.*,supplier.name supplier_name,supplier.address supplier_address,supplier.country supplier_country,supplier.website supplier_website,
    importer.name importer_entity_name,importer.address importer_address,importer.country importer_country,importer.website importer_website
    FROM importyeti_web_shipments sh LEFT JOIN importyeti_web_entities supplier ON supplier.id=sh.supplier_id LEFT JOIN importyeti_web_entities importer ON importer.id=sh.importer_id WHERE sh.id=?`).bind(id).first();
  if(!shipment)return NextResponse.json({error:"Shipment not found"},{status:404});
  return NextResponse.json({shipment,dataset:"importyeti_free_web",disclaimer:"Displayed date follows the source page date basis; estimated freight is not declared cargo value."});
}
