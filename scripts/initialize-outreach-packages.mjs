#!/usr/bin/env node
import { DatabaseSync } from "node:sqlite";
import { readdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { generateOutreachDraft } from "../lib/leads/outreach-draft.ts";
import { contactRouteNote, draftChannelForContact, selectBestVerifiedContact } from "../lib/leads/outreach-package.ts";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const apply = process.argv.includes("--apply");
const databaseArg = process.argv.find(arg => arg.startsWith("--db="));
const stateDir = join(root, ".wrangler", "state", "v3", "d1", "miniflare-D1DatabaseObject");
const dbFile = databaseArg?.slice(5) || readdirSync(stateDir)
  .filter(file => file.endsWith(".sqlite") && file !== "metadata.sqlite")
  .map(file => join(stateDir, file))
  .sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs)
  .find(file => statSync(file).size > 0);
if (!dbFile) throw new Error("Target database not found");

const db = new DatabaseSync(dbFile);
const buyers = db.prepare(`SELECT w.company_id, w.outreach_strategy, w.recommended_products,
    e.name company_name, e.total_shipments,
    COALESCE(e.latest_shipment_date,(SELECT MAX(s.shipment_date) FROM importyeti_web_shipments s WHERE s.importer_id=e.id)) latest_shipment_date,
    r.reason research_reason, r.next_action research_next_action
  FROM buyer_watchlist w
  JOIN importyeti_web_entities e ON e.id=w.company_id
  JOIN lead_contact_research r ON r.company_id=w.company_id AND r.status='verified'
  WHERE w.lead_status='contact_ready' AND e.identity_status='source_verified'
  ORDER BY COALESCE(w.outreach_score,0) DESC, e.name`).all();
const report = {mode: apply ? "apply" : "dry-run", database: dbFile, eligible: buyers.length, created: 0, skipped: 0, companies: []};

db.exec("BEGIN IMMEDIATE");
try {
  for (const buyer of buyers) {
    const existing = db.prepare("SELECT id,status FROM lead_outreach_drafts WHERE company_id=? AND status<>'archived' LIMIT 1").get(buyer.company_id);
    const contacts = db.prepare(`SELECT contact_type contactType, contact_value contactValue, label,
      source_url sourceUrl, verification_status verificationStatus
      FROM lead_contacts WHERE company_id=?`).all(buyer.company_id);
    const contact = selectBestVerifiedContact(contacts);
    if (existing || !contact) {
      report.skipped += 1;
      report.companies.push({companyId: buyer.company_id, companyName: buyer.company_name, status: existing ? "existing_draft" : "verified_contact_missing"});
      continue;
    }
    const generated = generateOutreachDraft({
      companyName: buyer.company_name,
      totalShipments: buyer.total_shipments,
      latestShipmentDate: buyer.latest_shipment_date,
      outreachStrategy: buyer.outreach_strategy,
      recommendedProducts: buyer.recommended_products,
      researchReason: buyer.research_reason,
      researchNextAction: buyer.research_next_action,
    });
    const channel = draftChannelForContact(contact);
    const id = `lod-${buyer.company_id}-verified-route`;
    if (apply) db.prepare(`INSERT INTO lead_outreach_drafts
      (id,company_id,channel,subject,body,status,evidence_summary,personalization_notes,created_at,updated_at)
      VALUES (?,?,?,?,?,'draft',?,?,?,?)
      ON CONFLICT(id) DO UPDATE SET
        channel=excluded.channel,subject=excluded.subject,body=excluded.body,status='draft',
        evidence_summary=excluded.evidence_summary,personalization_notes=excluded.personalization_notes,
        updated_at=excluded.updated_at`).run(
        id, buyer.company_id, channel, generated.subject, generated.body, generated.evidenceSummary,
        `${generated.personalizationNotes} ${contactRouteNote(contact)}`, new Date().toISOString(), new Date().toISOString(),
      );
    report.created += 1;
    report.companies.push({companyId: buyer.company_id, companyName: buyer.company_name, status: "prepared", channel, contact: contact.contactValue});
  }
  db.exec(apply ? "COMMIT" : "ROLLBACK");
  console.log(JSON.stringify(report, null, 2));
} catch (error) {
  try { db.exec("ROLLBACK"); } catch {}
  throw error;
}
