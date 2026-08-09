#!/usr/bin/env node
import { DatabaseSync } from "node:sqlite";
import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { buildWebsiteSearchQueries } from "../lib/company/website-evidence.ts";

const limit=Math.max(1,Math.min(100,Number(process.argv.find(arg=>arg.startsWith("--limit="))?.slice(8)||20)));
const type=process.argv.find(arg=>arg.startsWith("--type="))?.slice(7)||"all";
const databaseArg=process.argv.find(arg=>arg.startsWith("--db="));
if(!["all","importer","supplier"].includes(type))throw new Error("--type must be all, importer, or supplier");
const stateDir=join(process.cwd(),".wrangler","state","v3","d1","miniflare-D1DatabaseObject");
const dbFile=databaseArg?.slice(5)||readdirSync(stateDir).filter(file=>file.endsWith(".sqlite")&&file!=="metadata.sqlite").map(file=>join(stateDir,file)).sort((a,b)=>statSync(b).mtimeMs-statSync(a).mtimeMs)[0];
const db=new DatabaseSync(dbFile);
const rows=db.prepare(`SELECT e.id,e.entity_type,e.name,e.address,e.country,e.website_status,e.total_shipments,
  COALESCE(SUM(r.shipment_count),0) relationship_shipments,
  GROUP_CONCAT(DISTINCT r.product_descriptions) products
  FROM importyeti_web_entities e
  LEFT JOIN importyeti_web_relationships r ON (e.entity_type='importer' AND r.importer_id=e.id) OR (e.entity_type='supplier' AND r.supplier_id=e.id)
  WHERE (e.website IS NULL OR trim(e.website)='') AND COALESCE(e.website_status,'unknown')<>'reviewed_no_active_site' AND (?='all' OR e.entity_type=?)
  GROUP BY e.id
  ORDER BY CASE e.entity_type WHEN 'importer' THEN 0 ELSE 1 END, relationship_shipments DESC, COALESCE(e.total_shipments,0) DESC
  LIMIT ?`).all(type,type,limit);
const companies=rows.map((row,index)=>({priority:index+1,...row,searchQueries:buildWebsiteSearchQueries({name:row.name,address:row.address,country:row.country,products:row.products})}));
console.log(JSON.stringify({generatedAt:new Date().toISOString(),policy:"buyers first, then relationship shipments; missing websites only",count:companies.length,companies},null,2));
