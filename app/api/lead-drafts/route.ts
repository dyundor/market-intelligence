import { NextRequest, NextResponse } from "next/server";
import { env } from "cloudflare:workers";
import { generateOutreachDraft } from "../../../lib/leads/outreach-draft.ts";
import { LeadRepository } from "../../../lib/repositories/lead-repository.ts";

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
  const draft = await new LeadRepository(env.DB).updateDraft(id, {
    subject: body?.subject != null ? String(body.subject) : undefined,
    body: body?.body != null ? String(body.body) : undefined,
    status: body?.status != null ? String(body.status) as "draft"|"approved"|"sent"|"archived" : undefined,
  });
  if (!draft) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json(draft);
}
