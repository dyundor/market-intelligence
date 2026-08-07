import fs from "node:fs";

const files=process.argv.slice(2);
const quote=value=>value==null?"NULL":`'${String(value).replaceAll("'","''")}'`;
const rows=[];
for(const file of files){const payload=JSON.parse(fs.readFileSync(file,"utf8"));for(const row of payload.rows)rows.push({...row,supplierId:payload.supplierId,capturedAt:payload.capturedAt});}

console.log("BEGIN;");
const importers=new Map();
for(const row of rows) importers.set(row.importerSlug,row);
for(const row of importers.values()){
  const importerId=`importer:${row.importerSlug}`;
  const sourceUrl=`https://www.importyeti.com/company/${row.importerSlug}`;
  const sourceEntityKey=`importyeti_free_web:importer:${row.importerSlug}`;
  const country=row.importerCountry==="United States of America"?"United States":row.importerCountry;
  const countryCode=country==="United States"?"US":country==="Canada"?"CA":null;
  const oldSnapshot=`json_object('name',name,'country',country,'countryCode',country_code,'sourceUrl',source_url)`;
  const newSnapshot=quote(JSON.stringify({name:row.importerName,country,countryCode,sourceUrl}));
  console.log(`INSERT OR IGNORE INTO company_change_log (id,company_id,change_type,old_snapshot,new_snapshot,source_channel,source_url,changed_at) SELECT ${quote(`change:${row.capturedAt}:${importerId}`)},id,'profile_update',${oldSnapshot},${newSnapshot},'importyeti_free_web',${quote(sourceUrl)},${quote(row.capturedAt)} FROM importyeti_web_entities WHERE id=${quote(importerId)} AND (name<>${quote(row.importerName)} OR COALESCE(country,'')<>COALESCE(${quote(country)},'') OR COALESCE(country_code,'')<>COALESCE(${quote(countryCode)},'') OR source_url<>${quote(sourceUrl)});`);
  console.log(`INSERT INTO importyeti_web_entities (id,entity_type,name,country,country_code,contact_data_status,source_url,source_channel,source_entity_key,identity_status,first_seen_at,updated_at,record_version,source_attribution,search_query,captured_at,raw_evidence) VALUES (${quote(importerId)},'importer',${quote(row.importerName)},${quote(country)},${quote(countryCode)},'not_checked',${quote(sourceUrl)},'importyeti_free_web',${quote(sourceEntityKey)},'source_verified',${quote(row.capturedAt)},${quote(row.capturedAt)},1,'ImportYeti / U.S. Customs and Border Protection','recent shipment importer',${quote(row.capturedAt)},${quote(JSON.stringify({discoveredFromShipment:true}))}) ON CONFLICT(id) DO UPDATE SET name=excluded.name,country=COALESCE(excluded.country,importyeti_web_entities.country),country_code=COALESCE(excluded.country_code,importyeti_web_entities.country_code),source_url=excluded.source_url,source_entity_key=excluded.source_entity_key,updated_at=excluded.updated_at,captured_at=excluded.captured_at,record_version=CASE WHEN importyeti_web_entities.name<>excluded.name OR COALESCE(importyeti_web_entities.country,'')<>COALESCE(excluded.country,'') OR COALESCE(importyeti_web_entities.country_code,'')<>COALESCE(excluded.country_code,'') OR importyeti_web_entities.source_url<>excluded.source_url THEN importyeti_web_entities.record_version+1 ELSE importyeti_web_entities.record_version END;`);
  console.log(`INSERT INTO company_identity_aliases (id,company_id,alias_type,alias_value,normalized_value,source_channel,source_url,confidence,first_seen_at,last_seen_at) VALUES (${quote(`alias:name:${importerId}`)},${quote(importerId)},'official_name',${quote(row.importerName)},lower(trim(${quote(row.importerName)})),'importyeti_free_web',${quote(sourceUrl)},100,${quote(row.capturedAt)},${quote(row.capturedAt)}) ON CONFLICT(company_id,alias_type,normalized_value) DO UPDATE SET alias_value=excluded.alias_value,last_seen_at=excluded.last_seen_at,source_url=excluded.source_url;`);
  console.log(`INSERT INTO company_identity_aliases (id,company_id,alias_type,alias_value,normalized_value,source_channel,source_url,confidence,first_seen_at,last_seen_at) VALUES (${quote(`alias:source:${importerId}`)},${quote(importerId)},'source_key',${quote(sourceEntityKey)},lower(trim(${quote(sourceEntityKey)})),'importyeti_free_web',${quote(sourceUrl)},100,${quote(row.capturedAt)},${quote(row.capturedAt)}) ON CONFLICT(company_id,alias_type,normalized_value) DO UPDATE SET last_seen_at=excluded.last_seen_at,source_url=excluded.source_url;`);
}
for(const row of rows){
  const importerId=`importer:${row.importerSlug}`;
  const shipmentId=`iy:${row.houseBol||`${row.supplierId}:${row.shipmentDate}:${row.importerSlug}:${row.weightKg}`}`;
  const conflict=row.houseBol
    ? "ON CONFLICT(source_channel,house_bol) WHERE house_bol IS NOT NULL AND house_bol <> ''"
    : "ON CONFLICT(id)";
  console.log(`INSERT INTO importyeti_web_shipments (id,supplier_id,importer_id,importer_name,shipment_date,date_basis,actual_arrival_date,house_bol,master_bol,weight_kg,quantity,quantity_unit,container_count,product_description,estimated_freight_usd,source_url,source_channel,captured_at) VALUES (${quote(shipmentId)},${quote(row.supplierId)},${quote(importerId)},${quote(row.importerName)},${quote(row.shipmentDate)},'importyeti_recent_shipments_display_date',${quote(row.shipmentDate)},${quote(row.houseBol)},${quote(row.masterBol)},${quote(row.weightKg)},${quote(row.quantity)},${quote(row.quantityUnit)},${quote(row.containerCount)},${quote(row.productDescription)},${quote(row.estimatedFreightUsd)},${quote(row.sourceUrl)},'importyeti_free_web',${quote(row.capturedAt)}) ${conflict} DO UPDATE SET supplier_id=excluded.supplier_id,importer_id=excluded.importer_id,importer_name=excluded.importer_name,shipment_date=excluded.shipment_date,actual_arrival_date=excluded.actual_arrival_date,master_bol=COALESCE(excluded.master_bol,importyeti_web_shipments.master_bol),weight_kg=COALESCE(excluded.weight_kg,importyeti_web_shipments.weight_kg),quantity=COALESCE(excluded.quantity,importyeti_web_shipments.quantity),quantity_unit=COALESCE(excluded.quantity_unit,importyeti_web_shipments.quantity_unit),container_count=COALESCE(excluded.container_count,importyeti_web_shipments.container_count),product_description=COALESCE(excluded.product_description,importyeti_web_shipments.product_description),estimated_freight_usd=COALESCE(excluded.estimated_freight_usd,importyeti_web_shipments.estimated_freight_usd),source_url=excluded.source_url,captured_at=excluded.captured_at;`);
}
const productMap=[
  ["龙头及阀类","8481.80","848180"],["龙头阀门零件","8481.90","848190"],["塑料浴缸及淋浴盆","3922.10","392210"],
  ["瓷制陶瓷洁具","6910.10","691010"],["其他陶瓷洁具","6910.90","691090"],["钢铁卫浴制品","7324.90","732490"],["铜制卫浴制品","7418.20","741820"],
];
const suppliers=new Map(rows.map(row=>[row.supplierId,row]));
for(const [supplierId,row] of suppliers){
  for(const [productKey,hsPattern,hsCode] of productMap){
    console.log(`INSERT INTO shipment_collection_coverage (id,source_channel,entity_id,entity_role,product_key,hs_code,month,status,observed_shipments,pages_completed,classification_basis,source_url,first_observed_at,last_attempt_at,updated_at) SELECT 'coverage:importyeti:'||${quote(supplierId)}||':'||${quote(productKey)}||':'||substr(s.shipment_date,1,7),'importyeti_free_web',${quote(supplierId)},'supplier',${quote(productKey)},${quote(hsCode)},substr(s.shipment_date,1,7),'partial',COUNT(*),1,'supplier_relationship_hs',MAX(s.source_url),MIN(s.captured_at),${quote(row.capturedAt)},${quote(row.capturedAt)} FROM importyeti_web_shipments s WHERE s.supplier_id=${quote(supplierId)} AND EXISTS (SELECT 1 FROM importyeti_web_relationships r WHERE r.supplier_id=${quote(supplierId)} AND r.hs_codes LIKE ${quote(`%${hsPattern}%`)}) GROUP BY substr(s.shipment_date,1,7) ON CONFLICT(source_channel,entity_id,product_key,month) DO UPDATE SET observed_shipments=excluded.observed_shipments,status=CASE WHEN shipment_collection_coverage.status IN ('complete','no_records') THEN shipment_collection_coverage.status ELSE 'partial' END,last_attempt_at=excluded.last_attempt_at,updated_at=excluded.updated_at;`);
  }
  console.log(`UPDATE shipment_collection_jobs SET status=CASE WHEN status='completed' THEN status ELSE 'in_progress' END,pages_completed=MAX(pages_completed,1),shipments_collected=(SELECT COUNT(*) FROM importyeti_web_shipments WHERE supplier_id=${quote(supplierId)}),updated_at=${quote(row.capturedAt)},last_error=NULL WHERE source_channel='importyeti_free_web' AND entity_id=${quote(supplierId)};`);
}
console.log("COMMIT;");
