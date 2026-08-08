#!/usr/bin/env node
import { createHash } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const root=dirname(dirname(fileURLToPath(import.meta.url)));
const apply=process.argv.includes("--apply");
const databaseArg=process.argv.find(arg=>arg.startsWith("--db="));
const manifestArg=process.argv.find(arg=>arg.startsWith("--manifest="));
const manifestPath=manifestArg?.slice(11)||"data/importyeti-capture-manifest-2026-08-05.json";
const manifest=JSON.parse(readFileSync(join(root,manifestPath),"utf8"));
const manifestId=createHash("sha256").update(JSON.stringify(manifest)).digest("hex");
const stateDir=join(root,".wrangler","state","v3","d1","miniflare-D1DatabaseObject");
const dbFile=databaseArg?.slice(5)||readdirSync(stateDir).filter(file=>file.endsWith(".sqlite")&&file!=="metadata.sqlite").map(file=>join(stateDir,file)).sort((a,b)=>statSync(b).mtimeMs-statSync(a).mtimeMs).find(file=>statSync(file).size>0);
if(!dbFile||!existsSync(dbFile))throw new Error("Target database not found");

function scalar(db,sql){return Number(db.prepare(sql).get()?.value||0)}
function stats(db){return{
  entities:scalar(db,"SELECT COUNT(*) value FROM importyeti_web_entities WHERE id NOT LIKE 'seed-%'"),
  realImporters:scalar(db,"SELECT COUNT(*) value FROM importyeti_web_entities WHERE entity_type='importer' AND id NOT LIKE 'seed-%'"),
  sourceVerifiedImporters:scalar(db,"SELECT COUNT(*) value FROM importyeti_web_entities WHERE entity_type='importer' AND id NOT LIKE 'seed-%' AND identity_status='source_verified'"),
  shipments:scalar(db,"SELECT COUNT(*) value FROM importyeti_web_shipments WHERE id NOT LIKE 'seed-%'"),
  linkedShipments:scalar(db,"SELECT COUNT(*) value FROM importyeti_web_shipments WHERE id NOT LIKE 'seed-%' AND importer_id IS NOT NULL"),
  relationships:scalar(db,"SELECT COUNT(*) value FROM importyeti_web_relationships WHERE id NOT LIKE 'seed-%'"),
}}

const files=manifest.files.map(entry=>{
  const relative=normalize(entry.path);
  if(relative.startsWith("..")||!relative.startsWith("data/"))throw new Error(`Unsafe manifest path: ${entry.path}`);
  const path=join(root,relative);const sql=readFileSync(path,"utf8");
  const actual=createHash("sha256").update(sql).digest("hex");
  if(actual!==entry.sha256)throw new Error(`Checksum mismatch: ${entry.path}`);
  const scannedSql=sql.replace(/^\s*--.*$/gm,"");
  if(/\b(DROP|ALTER|ATTACH|DETACH|PRAGMA|VACUUM|REINDEX)\b/i.test(scannedSql))throw new Error(`Unsafe SQL operation: ${entry.path}`);
  if(/\bDELETE\s+FROM\b/i.test(scannedSql)&&!entry.allowsControlledDelete)throw new Error(`Unapproved DELETE: ${entry.path}`);
  const executionSql=sql.replace(/^\s*(BEGIN|COMMIT|ROLLBACK)\s*;\s*$/gmi,"");
  return{...entry,sql:executionSql};
});

const db=new DatabaseSync(dbFile);
const requiredColumns=["identity_confidence","identity_notes"];
const columns=new Set(db.prepare("SELECT name FROM pragma_table_info('importyeti_web_entities')").all().map(row=>row.name));
for(const column of requiredColumns)if(!columns.has(column))throw new Error(`Missing required migration column: ${column}`);
const previousPromotion=db.prepare("SELECT report_json FROM capture_promotions WHERE id=?").get(manifestId);
if(previousPromotion){
  const previous=JSON.parse(previousPromotion.report_json);
  console.log(JSON.stringify({...previous,mode:apply?"already-applied":"already-applied-dry-run",database:dbFile,manifest:manifestPath,manifestId},null,2));
  process.exit(0);
}
const protectedRows=db.prepare("SELECT id,address,website,website_status,website_source_url,website_verified_at,contact_data_status FROM importyeti_web_entities").all();
const before=stats(db);let after;let protectedFields=0;

db.exec("BEGIN IMMEDIATE");
try{
  for(const file of files)db.exec(file.sql);
  const restore=db.prepare(`UPDATE importyeti_web_entities SET address=?,website=?,website_status=?,website_source_url=?,website_verified_at=?,contact_data_status=? WHERE id=?`);
  const current=db.prepare("SELECT address,website,website_status,website_source_url,website_verified_at,contact_data_status FROM importyeti_web_entities WHERE id=?");
  for(const old of protectedRows){
    const now=current.get(old.id);if(!now)continue;
    const protectAddress=old.address&&String(old.address).length>String(now.address||"").length;
    const protectWebsite=old.website&&(!now.website||String(old.website_status||"").startsWith("verified"));
    const protectContact=old.contact_data_status&&old.contact_data_status!=="not_checked"&&now.contact_data_status==="not_checked";
    if(protectAddress||protectWebsite||protectContact){restore.run(protectAddress?old.address:now.address,protectWebsite?old.website:now.website,protectWebsite?old.website_status:now.website_status,protectWebsite?old.website_source_url:now.website_source_url,protectWebsite?old.website_verified_at:now.website_verified_at,protectContact?old.contact_data_status:now.contact_data_status,old.id);protectedFields+=Number(protectAddress)+Number(protectWebsite)+Number(protectContact);}
  }
  after=stats(db);
  const failures=[];
  for(const [key,minimum] of Object.entries(manifest.minimums))if(after[key]<minimum)failures.push(`${key} ${after[key]} < ${minimum}`);
  const orphanRelationships=scalar(db,"SELECT COUNT(*) value FROM importyeti_web_relationships r LEFT JOIN importyeti_web_entities s ON s.id=r.supplier_id LEFT JOIN importyeti_web_entities i ON i.id=r.importer_id WHERE s.id IS NULL OR i.id IS NULL");
  const orphanShipments=scalar(db,"SELECT COUNT(*) value FROM importyeti_web_shipments sh LEFT JOIN importyeti_web_entities s ON s.id=sh.supplier_id LEFT JOIN importyeti_web_entities i ON i.id=sh.importer_id WHERE s.id IS NULL OR (sh.importer_id IS NOT NULL AND i.id IS NULL)");
  const missingTrace=scalar(db,"SELECT COUNT(*) value FROM importyeti_web_shipments WHERE source_url IS NULL OR source_url='' OR captured_at IS NULL OR captured_at='' OR source_channel IS NULL OR source_channel=''");
  if(orphanRelationships)failures.push(`${orphanRelationships} orphan relationships`);
  if(orphanShipments)failures.push(`${orphanShipments} orphan shipments`);
  if(missingTrace)failures.push(`${missingTrace} shipments missing traceability`);
  if(failures.length)throw new Error(`Capture validation failed: ${failures.join("; ")}`);
  const report={mode:apply?"apply":"dry-run",database:dbFile,manifest:manifestPath,manifestId,filesVerified:files.length,before,after,protectedFields,validation:{orphanRelationships,orphanShipments,missingTrace,passed:true}};
  if(apply){db.prepare("INSERT INTO capture_promotions (id,manifest_path,source_channel,captured_at,applied_at,report_json) VALUES (?,?,?,?,?,?)").run(manifestId,manifestPath,manifest.sourceChannel,manifest.capturedAt,new Date().toISOString(),JSON.stringify(report));db.exec("COMMIT");}else db.exec("ROLLBACK");
  console.log(JSON.stringify(report,null,2));
}catch(error){try{db.exec("ROLLBACK")}catch{}throw error}
