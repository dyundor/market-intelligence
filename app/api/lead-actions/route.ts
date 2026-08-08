import { NextRequest, NextResponse } from "next/server";
import { env } from "cloudflare:workers";
import { LeadRepository } from "../../../lib/repositories/lead-repository.ts";

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

  const repo = new LeadRepository(env.DB);
  const action = await repo.createAction({
    companyId: String(body.companyId),
    actionType: String(body.actionType),
    direction: String(body.direction || "outbound") as "outbound" | "inbound",
    channel: body.channel ? String(body.channel) : null,
    summary: String(body.summary),
    outcome: body.outcome ? String(body.outcome) : null,
    nextAction: body.nextAction ? String(body.nextAction) : null,
    nextActionDue: body.nextActionDue ? String(body.nextActionDue) : null,
    performedBy: String(body.performedBy || "manual"),
  });
  return NextResponse.json(action, { status: 201 });
}
