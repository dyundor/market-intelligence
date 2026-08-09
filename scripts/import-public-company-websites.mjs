#!/usr/bin/env node
import { DatabaseSync } from "node:sqlite";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { validateWebsiteResearch } from "../lib/company/website-evidence.ts";

const root=dirname(dirname(fileURLToPath(import.meta.url)));
const sourceFile=process.argv.find(arg=>arg.endsWith(".json"))||"data/public-company-websites-wave1-2026-08-09.json";
const apply=process.argv.includes("--apply");
const databaseArg=process.argv.find(arg=>arg.startsWith("--db="));
const stateDir=join(root,".wrangler","state","v3","d1","miniflare-D1DatabaseObject");
const dbFile=databaseArg?.slice(5)||readdirSync(stateDir).filter(file=>file.endsWith(".sqlite")&&file!=="metadata.sqlite").map(file=>join(stateDir,file)).sort((a,b)=>statSync(b).mtimeMs-statSync(a).mtimeMs).find(file=>statSync(file).size>0);
if(!dbFile||!existsSync(dbFile))throw new Error("Local D1 database not found");
const payload=JSON.parse(readFileSync(join(root,sourceFile),"utf8"));
const db=new DatabaseSync(dbFile);
const report={mode:apply?"apply":"dry-run",sourceFile,reviewed:0,written:0,unchanged:0,companies:[]};

for(const record of payload.companies){
  const errors=validateWebsiteResearch(record);
  if(errors.length)throw new Error(`${record.companyName}: ${errors.join("; ")}`);
  const existing=db.prepare("SELECT id,name,website,website_status FROM importyeti_web_entities WHERE id=?").get(record.companyId);
  if(!existing)throw new Error(`${record.companyName}: company id not found`);
  if(existing.name.trim().toLowerCase()!==record.companyName.trim().toLowerCase())throw new Error(`${record.companyName}: company id resolves to ${existing.name}`);
  const protectedWebsite=existing.website&&String(existing.website_status||"").startsWith("verified")&&existing.website!==record.website;
  const unchangedWebsite=existing.website===record.website&&existing.website_status===record.websiteStatus;
  report.companies.push({companyId:record.companyId,companyName:record.companyName,website:record.website,status:record.websiteStatus,protectedWebsite:!!protectedWebsite,unchangedWebsite});
  report.reviewed+=1;
  if(protectedWebsite||unchangedWebsite||!apply){report.unchanged+=Number(!!protectedWebsite||unchangedWebsite);continue;}
  const now=new Date().toISOString();
  const evidence={researchedAt:payload.researchedAt,searchStrategy:payload.searchStrategy,identitySignals:record.identitySignals,evidenceUrls:record.evidenceUrls,rejectedCandidates:record.rejectedCandidates||[]};
  db.prepare(`UPDATE importyeti_web_entities SET
    website=?,website_status=?,website_source_url=?,website_verified_at=?,updated_at=?,
    raw_evidence=json_set(CASE WHEN json_valid(raw_evidence) THEN raw_evidence ELSE '{}' END,'$.website_research',json(?))
    WHERE id=?`).run(record.website,record.websiteStatus,record.websiteSourceUrl,now,now,JSON.stringify(evidence),record.companyId);
  report.written+=1;
}

console.log(JSON.stringify(report,null,2));
