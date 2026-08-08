import { NextRequest, NextResponse } from "next/server";
import { env } from "cloudflare:workers";
import { evaluateOutreachReadiness } from "../../../lib/leads/outreach-readiness.ts";

export async function GET(request: NextRequest) {
  if (!env.DB) return NextResponse.json({error:"Database unavailable"},{status:503});
  const companyId=request.nextUrl.searchParams.get("companyId")||"";
  if (!companyId) return NextResponse.json({error:"companyId required"},{status:400});
  const result=await env.DB.prepare(
    `SELECT e.identity_status,w.lead_status,
      (SELECT COUNT(*) FROM lead_contacts c WHERE c.company_id=e.id AND c.verification_status='verified') verified_contact_count,
      (SELECT status FROM lead_contact_research r WHERE r.company_id=e.id LIMIT 1) contact_research_status
     FROM importyeti_web_entities e LEFT JOIN buyer_watchlist w ON w.company_id=e.id WHERE e.id=?`,
  ).bind(companyId).all();
  const row=(result.results||[])[0];
  if (!row) return NextResponse.json({error:"company not found"},{status:404});
  const input={identityVerified:String(row.identity_status||"")==="source_verified",verifiedContactCount:Number(row.verified_contact_count||0),contactResearchStatus:row.contact_research_status?String(row.contact_research_status):null,leadStatus:row.lead_status?String(row.lead_status):null};
  return NextResponse.json({...evaluateOutreachReadiness(input),...input});
}
