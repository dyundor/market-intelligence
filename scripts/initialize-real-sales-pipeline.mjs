#!/usr/bin/env node
import { DatabaseSync } from "node:sqlite";
import { readdirSync,statSync } from "node:fs";
import { dirname,join } from "node:path";
import { fileURLToPath } from "node:url";
import { LeadInitializer } from "../lib/leads/initializer.ts";
import { shouldInitializeSalesLead } from "../lib/leads/pipeline-selection.ts";

const root=dirname(dirname(fileURLToPath(import.meta.url)));
const apply=process.argv.includes("--apply");
const databaseArg=process.argv.find(arg=>arg.startsWith("--db="));
const limitArg=process.argv.find(arg=>arg.startsWith("--limit="));
const limit=Math.min(50,Math.max(1,Number(limitArg?.slice(8)||25)));
const stateDir=join(root,".wrangler","state","v3","d1","miniflare-D1DatabaseObject");
const dbFile=databaseArg?.slice(5)||readdirSync(stateDir).filter(file=>file.endsWith(".sqlite")&&file!=="metadata.sqlite").map(file=>join(stateDir,file)).sort((a,b)=>statSync(b).mtimeMs-statSync(a).mtimeMs).find(file=>statSync(file).size>0);
if(!dbFile)throw new Error("Target database not found");
const rawDb=new DatabaseSync(dbFile);
const db={prepare(sql){const statement=rawDb.prepare(sql);return{bind(...args){return{async all(){return{results:statement.all(...args)}},async run(){const result=statement.run(...args);return{meta:{changes:result.changes}}}}}}}};
const initializer=new LeadInitializer(db);
const candidates=await initializer.getEvidenceBuyers(limit);
const report={mode:apply?"apply":"dry-run",database:dbFile,candidates:candidates.length,selected:0,skipped:0,leads:[]};
rawDb.exec("BEGIN IMMEDIATE");
try{
  for(const candidate of candidates){
    const lead=await initializer.generateLeadRecord(candidate);
    const existing=Boolean(rawDb.prepare("SELECT 1 found FROM buyer_watchlist WHERE company_id=?").get(candidate.buyerId));
    const decision=shouldInitializeSalesLead({existing,identityStatus:String(candidate.entity.identity_status||""),identityConfidence:candidate.entity.identity_confidence==null?null:Number(candidate.entity.identity_confidence),evidenceShipments:candidate.metricValue,lead});
    report.leads.push({companyId:candidate.buyerId,companyName:String(candidate.entity.name),evidenceRank:candidate.rank,evidenceShipments:candidate.metricValue,identityConfidence:candidate.entity.identity_confidence,selected:decision.selected,reason:decision.reason,leadStatus:lead.leadStatus,outreachStrategy:lead.outreachStrategy,recommendedProducts:lead.recommendedProducts,commercialFitScore:lead.commercialFitScore,outreachScore:lead.outreachScore});
    if(!decision.selected){report.skipped+=1;continue}
    await initializer.initializeLead(candidate.buyerId,lead);report.selected+=1;
  }
  if(apply)rawDb.exec("COMMIT");else rawDb.exec("ROLLBACK");
  console.log(JSON.stringify(report,null,2));
}catch(error){try{rawDb.exec("ROLLBACK")}catch{}throw error}
