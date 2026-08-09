import { NextResponse } from "next/server";
import { env } from "cloudflare:workers";
import { rankHotProducts, type ProductShipmentEvidence } from "../../../lib/products/hot-products.ts";
import { computeConfidence } from "../../../lib/data-confidence.ts";

export async function GET(){
  if(!env.DB)return NextResponse.json({error:"Database unavailable"},{status:503});
  const result=await env.DB.prepare(`SELECT sh.id,sh.importer_id,COALESCE(sh.importer_name,i.name) importer_name,sh.product_description,sh.shipment_date,sh.weight_kg
    FROM importyeti_web_shipments sh LEFT JOIN importyeti_web_entities i ON i.id=sh.importer_id
    WHERE sh.product_description IS NOT NULL AND trim(sh.product_description)<>''`).all();
  const records=(result.results||[]) as unknown as ProductShipmentEvidence[];
  const products=rankHotProducts(records);
  const latestDate=records.map(r=>r.shipment_date||"").filter(Boolean).sort().at(-1)||"";
  const productsWithConfidence=products.map(p=>({...p,confidence:computeConfidence({shipmentRecords:p.shipments,matchedRecords:p.shipments,mixedRecords:0,categories:1,lastUpdated:p.latestShipmentDate||latestDate,dataSource:p.confidence?.dataSource||"stored_us_ocean_import_shipments"})}));
  return NextResponse.json({dataset:"stored_us_ocean_import_shipments",scope:"Stored shipment evidence only; mixed-product shipments may support more than one product.",shipmentRecords:records.length,products:productsWithConfidence});
}
