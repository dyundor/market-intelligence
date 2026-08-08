import { NextResponse } from "next/server";
import { env } from "cloudflare:workers";
import { computePipelineMetrics } from "../../../lib/leads/feedback.ts";
import { buildSalesPriorityQueue, computeOpportunityMetrics } from "../../../lib/leads/opportunity-pipeline.ts";
import { quoteReadiness } from "../../../lib/leads/qualification-profile.ts";
import { computeQuoteFunnel } from "../../../lib/leads/quote-funnel.ts";

export async function GET() {
  if (!env.DB) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });
  const rows = await env.DB.prepare(
    `SELECT w.company_id, w.lead_status,w.opportunity_value_usd,w.opportunity_probability,w.expected_close_date,
      w.target_market,w.required_certifications,w.estimated_annual_units,w.target_moq,w.quote_requirements,
      (SELECT outcome_code FROM lead_actions a WHERE a.company_id=w.company_id AND a.outcome_code IS NOT NULL ORDER BY a.created_at DESC LIMIT 1) outcome_code,
      (SELECT next_action_due FROM lead_actions a WHERE a.company_id=w.company_id AND a.next_action_due IS NOT NULL ORDER BY a.created_at DESC LIMIT 1) next_action_due,
      (SELECT next_action FROM lead_actions a WHERE a.company_id=w.company_id AND a.next_action_due IS NOT NULL ORDER BY a.created_at DESC LIMIT 1) next_action,
      e.name company_name
     FROM buyer_watchlist w LEFT JOIN importyeti_web_entities e ON e.id=w.company_id`,
  ).bind().all();
  const outcomeRows=await env.DB.prepare(`SELECT DISTINCT company_id,outcome_code FROM lead_actions WHERE outcome_code IN ('quote_requested','quote_sent','won','lost')`).bind().all();
  const today = new Date().toISOString().slice(0, 10);
  const items = (rows.results || []).map(row => ({companyId:String(row.company_id),companyName:String(row.company_name||row.company_id),leadStatus:row.lead_status?String(row.lead_status):"new",opportunityValueUsd:row.opportunity_value_usd==null?null:Number(row.opportunity_value_usd),opportunityProbability:row.opportunity_probability==null?null:Number(row.opportunity_probability),expectedCloseDate:row.expected_close_date?String(row.expected_close_date):null,outcomeCode:row.outcome_code?String(row.outcome_code):null,nextActionDue:row.next_action_due?String(row.next_action_due):null,nextAction:row.next_action?String(row.next_action):null,quoteReadiness:quoteReadiness({targetMarket:row.target_market?String(row.target_market):null,requiredCertifications:row.required_certifications?String(row.required_certifications):null,estimatedAnnualUnits:row.estimated_annual_units==null?null:Number(row.estimated_annual_units),targetMoq:row.target_moq==null?null:Number(row.target_moq),quoteRequirements:row.quote_requirements?String(row.quote_requirements):null})}));
  const quoteFunnel=computeQuoteFunnel((outcomeRows.results||[]).map(row=>({companyId:String(row.company_id),outcomeCode:String(row.outcome_code)})));
  const metrics = {...computePipelineMetrics(items, today),...computeOpportunityMetrics(items),...quoteFunnel};
  const tasks = buildSalesPriorityQueue(items, today).map(task=>{
    const item=items.find(candidate=>candidate.companyId===task.companyId);
    if(item?.outcomeCode==="quote_requested"&&!item.quoteReadiness.ready) return {...task,nextAction:`Complete quote qualification (${item.quoteReadiness.missing.length} missing): ${item.quoteReadiness.missing.join(", ")}`};
    return task;
  });
  return NextResponse.json({metrics,tasks,today});
}
