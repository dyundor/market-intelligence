import { NextRequest, NextResponse } from "next/server";
import { env } from "cloudflare:workers";
import { LeadRepository } from "../../../lib/repositories/lead-repository.ts";
import { defaultFollowUpForOutcome, leadStatusForOutcome, type OutcomeCode } from "../../../lib/leads/feedback.ts";

const OUTCOMES = new Set(["no_response", "replied", "interested", "meeting_booked", "quote_requested", "quote_sent", "not_fit", "bounced", "won", "lost"]);
const FIT_FEEDBACK = new Set(["confirmed_fit", "needs_review", "disqualified"]);

export async function GET(request: NextRequest) {
  if (!env.DB) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });
  const companyId = request.nextUrl.searchParams.get("companyId") || "";
  if (!companyId) return NextResponse.json({ error: "companyId required" }, { status: 400 });
  const repo = new LeadRepository(env.DB);
  const actions = await repo.listActions(companyId);
  return NextResponse.json({ items: actions });
}

export async function POST(request: NextRequest) {
  if (!env.DB) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!body?.companyId || !body?.actionType || !body?.summary) {
    return NextResponse.json({ error: "companyId, actionType, and summary required" }, { status: 400 });
  }
  const outcomeCode = body.outcomeCode ? String(body.outcomeCode) : null;
  if (outcomeCode && !OUTCOMES.has(outcomeCode)) return NextResponse.json({ error: "invalid outcomeCode" }, { status: 400 });
  const qualificationFeedback = body.qualificationFeedback ? String(body.qualificationFeedback) : null;
  if (qualificationFeedback && !FIT_FEEDBACK.has(qualificationFeedback)) return NextResponse.json({ error: "invalid qualificationFeedback" }, { status: 400 });
  const defaultFollowUp = outcomeCode
    ? defaultFollowUpForOutcome(outcomeCode as OutcomeCode, new Date().toISOString().slice(0, 10))
    : null;

  const repo = new LeadRepository(env.DB);
  const action = await repo.createAction({
    companyId: String(body.companyId),
    actionType: String(body.actionType),
    direction: String(body.direction || "outbound") as "outbound" | "inbound",
    channel: body.channel ? String(body.channel) : null,
    summary: String(body.summary),
    outcome: body.outcome ? String(body.outcome) : null,
    outcomeCode,
    qualificationFeedback,
    feedbackReason: body.feedbackReason ? String(body.feedbackReason) : null,
    nextAction: body.nextAction ? String(body.nextAction) : defaultFollowUp?.nextAction ?? null,
    nextActionDue: body.nextActionDue ? String(body.nextActionDue) : defaultFollowUp?.nextActionDue ?? null,
    performedBy: String(body.performedBy || "manual"),
  });
  const leadStatus = qualificationFeedback === "disqualified"
    ? "disqualified"
    : outcomeCode ? leadStatusForOutcome(outcomeCode as OutcomeCode) : null;
  if (leadStatus) {
    await env.DB.prepare(
      "UPDATE buyer_watchlist SET lead_status = ?, updated_at = ? WHERE company_id = ?",
    ).bind(leadStatus, new Date().toISOString(), String(body.companyId)).run();
  }
  return NextResponse.json({ ...action, leadStatus }, { status: 201 });
}
