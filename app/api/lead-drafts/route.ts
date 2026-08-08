import { NextRequest, NextResponse } from "next/server";
import { env } from "cloudflare:workers";
import { generateOutreachDraft } from "../../../lib/leads/outreach-draft.ts";
import { LeadRepository } from "../../../lib/repositories/lead-repository.ts";
import { evaluateOutreachReadiness } from "../../../lib/leads/outreach-readiness.ts";
import { draftSentActionId, shouldSyncDraftSent } from "../../../lib/leads/draft-lifecycle.ts";
import { addBusinessDays } from "../../../lib/leads/sales-task.ts";

const STATUSES = new Set(["draft", "approved", "sent", "archived"]);

export async function GET(request: NextRequest) {
  if (!env.DB) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });
  const companyId = request.nextUrl.searchParams.get("companyId") || "";
  if (!companyId) return NextResponse.json({ error: "companyId required" }, { status: 400 });
  return NextResponse.json({ items: await new LeadRepository(env.DB).listDrafts(companyId) });
}

export async function POST(request: NextRequest) {
  if (!env.DB) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!body?.companyId || !body?.companyName) return NextResponse.json({ error: "companyId and companyName required" }, { status: 400 });
  const generated = generateOutreachDraft({
    companyName: String(body.companyName), contactName: body.contactName ? String(body.contactName) : null,
    totalShipments: body.totalShipments == null ? null : Number(body.totalShipments),
    latestShipmentDate: body.latestShipmentDate ? String(body.latestShipmentDate) : null,
    outreachStrategy: body.outreachStrategy ? String(body.outreachStrategy) : null,
    recommendedProducts: body.recommendedProducts ? String(body.recommendedProducts) : null,
    companyType: body.companyType ? String(body.companyType) : null,
  });
  const draft = await new LeadRepository(env.DB).createDraft({companyId:String(body.companyId),channel:"email",status:"draft",...generated});
  return NextResponse.json(draft, { status: 201 });
}

export async function PATCH(request: NextRequest) {
  if (!env.DB) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  const id = String(body?.id || "");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  if (body?.status != null && !STATUSES.has(String(body.status))) return NextResponse.json({ error: "invalid status" }, { status: 400 });
  let currentDraft: Record<string, unknown> | null = null;
  if (body?.status === "approved" || body?.status === "sent") {
    const actionId=draftSentActionId(id);
    const draftRows=await env.DB.prepare(`SELECT company_id,status,channel,
      EXISTS(SELECT 1 FROM lead_actions WHERE id=?) sent_action_exists
      FROM lead_outreach_drafts WHERE id=?`).bind(actionId,id).all();
    currentDraft=((draftRows.results||[])[0]||null) as Record<string,unknown>|null;
    const companyId=currentDraft?.company_id;
    if (!companyId) return NextResponse.json({error:"not found"},{status:404});
    const readinessRows=await env.DB.prepare(
      `SELECT e.identity_status,
        (SELECT COUNT(*) FROM lead_contacts c WHERE c.company_id=e.id AND c.verification_status='verified') verified_contact_count,
        (SELECT status FROM lead_contact_research r WHERE r.company_id=e.id LIMIT 1) contact_research_status
       FROM importyeti_web_entities e WHERE e.id=?`,
    ).bind(companyId).all();
    const row=(readinessRows.results||[])[0];
    const readiness=evaluateOutreachReadiness({identityVerified:String(row?.identity_status||"")==="source_verified",verifiedContactCount:Number(row?.verified_contact_count||0),contactResearchStatus:row?.contact_research_status?String(row.contact_research_status):null});
    if (!readiness.ready) return NextResponse.json({error:"outreach_not_ready",blockers:readiness.blockers},{status:409});
  }
  const repository=new LeadRepository(env.DB);
  const syncSent=currentDraft && shouldSyncDraftSent(String(currentDraft.status||""),body?.status?String(body.status):undefined,Boolean(currentDraft.sent_action_exists));
  if (syncSent) {
    const now=new Date().toISOString();
    const actionId=draftSentActionId(id);
    const companyId=String(currentDraft.company_id);
    const followUpDue=addBusinessDays(now.slice(0,10),3);
    await env.DB.batch([
      env.DB.prepare(`UPDATE lead_outreach_drafts SET
        subject=CASE WHEN ?=1 THEN ? ELSE subject END,
        body=CASE WHEN ?=1 THEN ? ELSE body END,status='sent',updated_at=? WHERE id=?`).bind(
          body?.subject!=null?1:0,body?.subject!=null?String(body.subject):"",
          body?.body!=null?1:0,body?.body!=null?String(body.body):"",now,id,
        ),
      env.DB.prepare(`INSERT INTO lead_actions
        (id,company_id,action_type,direction,channel,summary,outcome,outcome_code,qualification_feedback,feedback_reason,next_action,next_action_due,performed_by,created_at)
        VALUES (?,?,'outreach','outbound',?,'Approved outreach draft marked as sent',NULL,NULL,NULL,NULL,'Follow up after initial outreach',?,'manual',?)
        ON CONFLICT(id) DO NOTHING`).bind(actionId,companyId,String(currentDraft.channel||"email"),followUpDue,now),
      env.DB.prepare("UPDATE lead_actions SET next_action_due=NULL WHERE company_id=? AND id<>? AND next_action_due IS NOT NULL").bind(companyId,actionId),
      env.DB.prepare(`UPDATE buyer_watchlist SET
        lead_status=CASE WHEN lead_status IN ('new','researching','contact_ready') THEN 'contacted' ELSE lead_status END,
        updated_at=? WHERE company_id=?`).bind(now,companyId),
    ]);
    const synced=(await repository.listDrafts(companyId)).find(item=>item.id===id);
    if (!synced) return NextResponse.json({error:"not found"},{status:404});
    return NextResponse.json(synced);
  }
  const draft = await repository.updateDraft(id, {
    subject: body?.subject != null ? String(body.subject) : undefined,
    body: body?.body != null ? String(body.body) : undefined,
    status: body?.status != null ? String(body.status) as "draft"|"approved"|"sent"|"archived" : undefined,
  });
  if (!draft) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json(draft);
}
