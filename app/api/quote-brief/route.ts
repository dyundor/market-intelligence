import { NextRequest, NextResponse } from "next/server";
import { env } from "cloudflare:workers";
import { buildQuoteHandoff } from "../../../lib/leads/quote-handoff.ts";

export async function GET(request:NextRequest){
  if(!env.DB)return NextResponse.json({error:"Database unavailable"},{status:503});
  const companyId=request.nextUrl.searchParams.get("companyId")||"";
  if(!companyId)return NextResponse.json({error:"companyId required"},{status:400});
  const result=await env.DB.prepare(`SELECT e.name company_name,w.recommended_products,w.target_market,
    w.required_certifications,w.estimated_annual_units,w.target_moq,w.quote_requirements,
    r.reason research_reason,r.next_action research_next_action,
    (SELECT outcome FROM lead_actions a WHERE a.company_id=w.company_id AND a.outcome_code='quote_requested' ORDER BY a.created_at DESC LIMIT 1) latest_outcome_notes
    FROM buyer_watchlist w JOIN importyeti_web_entities e ON e.id=w.company_id
    LEFT JOIN lead_contact_research r ON r.company_id=w.company_id WHERE w.company_id=? LIMIT 1`).bind(companyId).all();
  const row=(result.results||[])[0];
  if(!row)return NextResponse.json({error:"lead not found"},{status:404});
  const brief=buildQuoteHandoff({companyName:String(row.company_name),recommendedProducts:row.recommended_products?String(row.recommended_products):null,targetMarket:row.target_market?String(row.target_market):null,requiredCertifications:row.required_certifications?String(row.required_certifications):null,estimatedAnnualUnits:row.estimated_annual_units==null?null:Number(row.estimated_annual_units),targetMoq:row.target_moq==null?null:Number(row.target_moq),quoteRequirements:row.quote_requirements?String(row.quote_requirements):null,researchReason:row.research_reason?String(row.research_reason):null,researchNextAction:row.research_next_action?String(row.research_next_action):null,latestOutcomeNotes:row.latest_outcome_notes?String(row.latest_outcome_notes):null});
  if(!brief.ready)return NextResponse.json({error:"quote_qualification_incomplete",missing:brief.missing},{status:409});
  return NextResponse.json(brief);
}
