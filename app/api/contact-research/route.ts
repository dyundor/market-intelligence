import { NextResponse } from "next/server";
import { env } from "cloudflare:workers";
import { summarizeContactResearch, type ContactResearchStatus } from "../../../lib/leads/contact-research.ts";

export async function GET() {
  if (!env.DB) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });
  const rows = await env.DB.prepare(
    `SELECT r.id,r.company_name,r.company_id,r.status,r.reason_code,r.reason,r.next_action,
      r.evidence_urls,r.researched_at,e.name matched_company_name
     FROM lead_contact_research r
     LEFT JOIN importyeti_web_entities e ON e.id=r.company_id
     ORDER BY CASE r.status WHEN 'verified' THEN 2 WHEN 'needs_identity_match' THEN 0 ELSE 1 END,
       r.company_name`,
  ).bind().all();
  const items = (rows.results || []).map(row=>({
    id:String(row.id),companyName:String(row.company_name),companyId:row.company_id?String(row.company_id):null,
    matchedCompanyName:row.matched_company_name?String(row.matched_company_name):null,
    status:String(row.status) as ContactResearchStatus,reasonCode:String(row.reason_code),reason:String(row.reason),
    nextAction:String(row.next_action),evidenceUrls:JSON.parse(String(row.evidence_urls||"[]")),researchedAt:String(row.researched_at),
  }));
  return NextResponse.json({items,summary:summarizeContactResearch(items)});
}
