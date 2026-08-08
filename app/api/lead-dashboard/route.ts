import { NextResponse } from "next/server";
import { env } from "cloudflare:workers";
import { computePipelineMetrics } from "../../../lib/leads/feedback.ts";

export async function GET() {
  if (!env.DB) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });
  const rows = await env.DB.prepare(
    `SELECT w.company_id, w.lead_status,
      (SELECT outcome_code FROM lead_actions a WHERE a.company_id=w.company_id AND a.outcome_code IS NOT NULL ORDER BY a.created_at DESC LIMIT 1) outcome_code,
      (SELECT next_action_due FROM lead_actions a WHERE a.company_id=w.company_id AND a.next_action_due IS NOT NULL ORDER BY a.created_at DESC LIMIT 1) next_action_due,
      (SELECT next_action FROM lead_actions a WHERE a.company_id=w.company_id AND a.next_action_due IS NOT NULL ORDER BY a.created_at DESC LIMIT 1) next_action,
      e.name company_name
     FROM buyer_watchlist w LEFT JOIN importyeti_web_entities e ON e.id=w.company_id`,
  ).bind().all();
  const today = new Date().toISOString().slice(0, 10);
  const items = (rows.results || []).map(row => ({companyId:String(row.company_id),companyName:String(row.company_name||row.company_id),leadStatus:row.lead_status?String(row.lead_status):"new",outcomeCode:row.outcome_code?String(row.outcome_code):null,nextActionDue:row.next_action_due?String(row.next_action_due):null,nextAction:row.next_action?String(row.next_action):null}));
  const metrics = computePipelineMetrics(items, today);
  const tasks = items.filter(item=>item.nextActionDue).sort((a,b)=>String(a.nextActionDue).localeCompare(String(b.nextActionDue))).map(item=>({...item,timing:item.nextActionDue!<today?"overdue":item.nextActionDue===today?"today":"upcoming"}));
  return NextResponse.json({metrics,tasks,today});
}
