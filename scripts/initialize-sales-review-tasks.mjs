#!/usr/bin/env node
import { DatabaseSync } from "node:sqlite";
import { readdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { nextAvailableReviewDate } from "../lib/leads/sales-task.ts";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const apply = process.argv.includes("--apply");
const databaseArg = process.argv.find(arg => arg.startsWith("--db="));
const startArg = process.argv.find(arg => arg.startsWith("--start="));
const startDate = startArg?.slice(8) || new Date().toISOString().slice(0, 10);
const stateDir = join(root, ".wrangler", "state", "v3", "d1", "miniflare-D1DatabaseObject");
const dbFile = databaseArg?.slice(5) || readdirSync(stateDir)
  .filter(file => file.endsWith(".sqlite") && file !== "metadata.sqlite")
  .map(file => join(stateDir, file))
  .sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs)
  .find(file => statSync(file).size > 0);
if (!dbFile) throw new Error("Target database not found");

const db = new DatabaseSync(dbFile);
const buyers = db.prepare(`SELECT w.company_id,e.name company_name,w.outreach_score,d.channel
  FROM buyer_watchlist w
  JOIN importyeti_web_entities e ON e.id=w.company_id
  JOIN lead_outreach_drafts d ON d.company_id=w.company_id AND d.status='draft'
  WHERE w.lead_status='contact_ready'
    AND NOT EXISTS (SELECT 1 FROM lead_actions a WHERE a.company_id=w.company_id AND a.action_type='review_outreach')
  GROUP BY w.company_id,e.name,w.outreach_score,d.channel
  ORDER BY COALESCE(w.outreach_score,0) DESC,e.name`).all();
const report = {mode: apply ? "apply" : "dry-run", database: dbFile, eligible: buyers.length, created: 0, tasks: []};
const now = new Date().toISOString();
const scheduledByDate = Object.fromEntries(db.prepare(`SELECT next_action_due due,COUNT(*) count
  FROM lead_actions WHERE action_type='review_outreach' AND next_action_due IS NOT NULL
  GROUP BY next_action_due`).all().map(row => [row.due, Number(row.count)]));

db.exec("BEGIN IMMEDIATE");
try {
  buyers.forEach(buyer => {
    const due = nextAvailableReviewDate(startDate, scheduledByDate, 2);
    scheduledByDate[due] = (scheduledByDate[due] || 0) + 1;
    const nextAction = `Review the verified ${buyer.channel} outreach package and send manually through the approved contact route`;
    if (apply) db.prepare(`INSERT INTO lead_actions
      (id,company_id,action_type,direction,channel,summary,outcome,outcome_code,qualification_feedback,feedback_reason,next_action,next_action_due,performed_by,created_at)
      VALUES (?,?,'review_outreach','outbound',?,'Verified outreach package prepared for manual review',NULL,NULL,NULL,NULL,?,?,'system',?)`).run(
        `la-${buyer.company_id}-review-outreach`, buyer.company_id, buyer.channel, nextAction, due, now,
      );
    report.created += 1;
    report.tasks.push({companyId: buyer.company_id, companyName: buyer.company_name, channel: buyer.channel, due});
  });
  db.exec(apply ? "COMMIT" : "ROLLBACK");
  console.log(JSON.stringify(report, null, 2));
} catch (error) {
  try { db.exec("ROLLBACK"); } catch {}
  throw error;
}
