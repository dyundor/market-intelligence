#!/usr/bin/env node
import { DatabaseSync } from "node:sqlite";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { normalizeCompanyName } from "../lib/entities/company.ts";
import { contactResearchId, validateContactResearch } from "../lib/leads/contact-research.ts";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const sourceFile = process.argv.find(arg => arg.endsWith(".json")) || "data/public-contact-research-top10-2026-08-08.json";
const apply = process.argv.includes("--apply");
const databaseArg = process.argv.find(arg => arg.startsWith("--db="));
const payload = JSON.parse(readFileSync(join(root, sourceFile), "utf8"));
const stateDir = join(root, ".wrangler", "state", "v3", "d1", "miniflare-D1DatabaseObject");
if (!databaseArg && !existsSync(stateDir)) throw new Error("Local D1 state not found");
const dbFile = databaseArg?.slice(5) || readdirSync(stateDir).filter(file=>file.endsWith(".sqlite")&&file!=="metadata.sqlite").map(file=>join(stateDir,file)).sort((a,b)=>statSync(b).mtimeMs-statSync(a).mtimeMs).find(file=>statSync(file).size>0);
if (!dbFile) throw new Error("Local D1 database not found");
const db = new DatabaseSync(dbFile);
const candidates = db.prepare("SELECT id, name FROM importyeti_web_entities WHERE entity_type='importer'").all();
const report = {mode:apply?"apply":"dry-run",sourceFile,total:payload.companies.length,linked:0,unlinked:0,written:0,companies:[]};

for (const item of payload.companies) {
  const errors = validateContactResearch(item);
  if (errors.length) throw new Error(`${item.companyName}: ${errors.join("; ")}`);
  const normalized = normalizeCompanyName(item.companyName);
  const matches = candidates.filter(candidate=>normalizeCompanyName(candidate.name)===normalized);
  const companyId = matches.length===1 ? matches[0].id : null;
  report[companyId?"linked":"unlinked"] += 1;
  report.companies.push({companyName:item.companyName,status:item.status,companyId,matchStatus:matches.length===1?"matched":matches.length?"ambiguous":"unmatched"});
  if (!apply) continue;
  const now = new Date().toISOString();
  db.prepare(`INSERT INTO lead_contact_research
    (id,company_name,normalized_company_name,company_id,status,reason_code,reason,next_action,evidence_urls,researched_at,updated_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?)
    ON CONFLICT(normalized_company_name) DO UPDATE SET
      company_name=excluded.company_name,
      company_id=COALESCE(excluded.company_id,lead_contact_research.company_id),
      status=excluded.status,reason_code=excluded.reason_code,reason=excluded.reason,
      next_action=excluded.next_action,evidence_urls=excluded.evidence_urls,
      researched_at=excluded.researched_at,updated_at=excluded.updated_at`).run(
        contactResearchId(item.companyName),item.companyName,normalized,companyId,item.status,item.reasonCode,item.reason,item.nextAction,JSON.stringify(item.evidenceUrls),payload.researchedAt,now,
      );
  report.written += 1;
}

console.log(JSON.stringify(report,null,2));
