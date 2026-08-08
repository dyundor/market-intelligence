#!/usr/bin/env node
import { DatabaseSync } from "node:sqlite";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { matchCompanyEvidence, validatePublicEvidence } from "../lib/leads/public-contact-enrichment.ts";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const sourceFile = process.argv.find(arg => arg.endsWith(".json")) || "data/public-lead-contacts-top3-2026-08-08.json";
const apply = process.argv.includes("--apply");
const databaseArg = process.argv.find(arg => arg.startsWith("--db="));
const payload = JSON.parse(readFileSync(join(root, sourceFile), "utf8"));
const stateDir = join(root, ".wrangler", "state", "v3", "d1", "miniflare-D1DatabaseObject");
if (!existsSync(stateDir)) throw new Error("Local D1 state not found");
const dbFile = databaseArg?.slice(5) || readdirSync(stateDir).filter(file=>file.endsWith(".sqlite")&&file!=="metadata.sqlite").map(file=>join(stateDir,file)).sort((a,b)=>statSync(b).mtimeMs-statSync(a).mtimeMs).find(file=>statSync(file).size>0);
if (!dbFile) throw new Error("Local D1 database not found");
const db = new DatabaseSync(dbFile);
const candidates = db.prepare("SELECT id, name FROM importyeti_web_entities WHERE entity_type='importer'").all();
const report = {mode:apply?"apply":"dry-run",sourceFile,matched:0,unmatched:0,ambiguous:0,contactsWritten:0,companies:[]};

for (const company of payload.companies) {
  const errors = validatePublicEvidence(company);
  if (errors.length) throw new Error(`${company.companyName}: ${errors.join("; ")}`);
  const match = matchCompanyEvidence(company, candidates);
  const result = {companyName:company.companyName,status:match.status,companyId:match.company?.id||null,contacts:company.contacts.length};
  report.companies.push(result);
  if (match.status !== "matched") { report[match.status] += 1; continue; }
  report.matched += 1;
  if (!apply) continue;

  const companyId = match.company.id;
  const now = new Date().toISOString();
  db.prepare(`UPDATE importyeti_web_entities SET
    website=COALESCE(NULLIF(website,''),?),
    website_status=CASE WHEN website IS NULL OR website='' OR website_status NOT LIKE 'verified%' THEN 'verified_company_site' ELSE website_status END,
    website_source_url=COALESCE(NULLIF(website_source_url,''),?),
    website_verified_at=COALESCE(website_verified_at,?),
    contact_data_status='available'
    WHERE id=?`).run(company.website,company.websiteSourceUrl,now,companyId);
  if (company.identityEvidence) {
    const identityNote = `Official identity verified: ${company.identityEvidence.legalName}; ${company.identityEvidence.sourceUrl}; ${company.identityEvidence.note}`;
    db.prepare(`UPDATE importyeti_web_entities SET
      identity_status='source_verified',
      identity_confidence=MAX(COALESCE(identity_confidence,0),90),
      identity_notes=CASE
        WHEN identity_notes IS NULL OR identity_notes='' THEN ?
        WHEN INSTR(identity_notes,?)>0 THEN identity_notes
        ELSE identity_notes || ' | ' || ? END
      WHERE id=?`).run(identityNote,company.identityEvidence.sourceUrl,identityNote,companyId);
  }
  db.prepare(`INSERT INTO buyer_watchlist (id,company_id,status,notes,lead_status,created_at,updated_at)
    VALUES (?,?, 'researching','Public contact enrichment','researching',?,?)
    ON CONFLICT(company_id) DO UPDATE SET updated_at=excluded.updated_at`).run(`wl-${companyId}-public`,companyId,now,now);
  if (company.businessFit) {
    db.prepare(`UPDATE buyer_watchlist SET outreach_strategy=?,recommended_products=?,notes=?,updated_at=? WHERE company_id=?`).run(
      company.businessFit.outreachStrategy,company.businessFit.recommendedProducts,
      `Public contact enrichment: ${company.businessFit.reason}`,now,companyId,
    );
  }
  for (const contact of company.contacts) {
    db.prepare(`INSERT INTO lead_contacts
      (id,company_id,contact_type,contact_value,label,source_url,source_type,verified_at,verification_status,notes,created_at,updated_at)
      VALUES (?,?,?,?,?,?,'manual',?,?,?, ?,?)
      ON CONFLICT(company_id,contact_type,contact_value) DO UPDATE SET
        label=COALESCE(excluded.label,lead_contacts.label),source_url=excluded.source_url,
        verified_at=COALESCE(excluded.verified_at,lead_contacts.verified_at),
        verification_status=CASE WHEN lead_contacts.verification_status='verified' THEN lead_contacts.verification_status ELSE excluded.verification_status END,
        updated_at=excluded.updated_at`).run(`lc-${companyId}-${contact.type}-${report.contactsWritten}`,companyId,contact.type,contact.value,contact.label,contact.sourceUrl,contact.verificationStatus==="verified"?now:null,contact.verificationStatus,`Public official website research ${payload.researchedAt}`,now,now);
    report.contactsWritten += 1;
  }
  if (company.contacts.some(contact=>contact.verificationStatus==="verified")) {
    db.prepare("UPDATE buyer_watchlist SET lead_status='contact_ready',updated_at=? WHERE company_id=? AND lead_status IN ('new','researching')").run(now,companyId);
  }
}

console.log(JSON.stringify(report,null,2));
