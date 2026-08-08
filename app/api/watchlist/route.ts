import { NextRequest, NextResponse } from "next/server";
import { env } from "cloudflare:workers";
import { validateExpectedCloseDate, validateOpportunityProbability, validateOpportunityValue } from "../../../lib/leads/opportunity-pipeline.ts";

const STATUSES = new Set(["new", "researching", "contacted", "quoted", "customer"]);
const LEAD_STATUSES = new Set([
  "new", "researching", "contact_ready", "contacted",
  "follow_up", "qualified", "opportunity", "disqualified",
]);

export async function GET(_request: NextRequest) {
  if (!env.DB) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });
  const rows = await env.DB.prepare(
    `SELECT w.id,w.company_id,w.status,w.notes,w.created_at,w.updated_at,
      w.lead_status,w.outreach_strategy,w.recommended_products,w.confidence,
      w.commercial_fit_score,w.outreach_score,w.opportunity_value_usd,
      w.opportunity_probability,w.expected_close_date,
      e.name company_name,e.country company_country,e.country_code company_country_code,e.entity_type,
      e.total_shipments,e.latest_shipment_date,e.website,e.city_name,e.admin1_name
      FROM buyer_watchlist w LEFT JOIN importyeti_web_entities e ON e.id=w.company_id
      ORDER BY w.updated_at DESC`,
  ).all();
  return NextResponse.json({ items: (rows.results || []).map(row => ({
    id: String(row.id),
    companyId: String(row.company_id),
    status: String(row.status),
    notes: String(row.notes || ""),
    leadStatus: row.lead_status ? String(row.lead_status) : null,
    outreachStrategy: row.outreach_strategy ? String(row.outreach_strategy) : null,
    recommendedProducts: row.recommended_products ? String(row.recommended_products) : null,
    confidence: row.confidence ? String(row.confidence) : null,
    commercialFitScore: row.commercial_fit_score != null ? Number(row.commercial_fit_score) : null,
    outreachScore: row.outreach_score != null ? Number(row.outreach_score) : null,
    opportunityValueUsd: row.opportunity_value_usd != null ? Number(row.opportunity_value_usd) : null,
    opportunityProbability: row.opportunity_probability != null ? Number(row.opportunity_probability) : null,
    expectedCloseDate: row.expected_close_date ? String(row.expected_close_date) : null,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
    company: row.company_name ? {
      id: String(row.company_id),
      name: String(row.company_name),
      country: String(row.country || ""),
      countryCode: row.country_code ? String(row.country_code) : null,
      entityType: String(row.entity_type || ""),
      totalShipments: row.total_shipments === null || row.total_shipments === undefined ? null : Number(row.total_shipments),
      latestShipmentDate: row.latest_shipment_date ? String(row.latest_shipment_date) : null,
      website: row.website ? String(row.website) : null,
      location: [String(row.city_name || ""), String(row.admin1_name || "")].filter(Boolean).join(", "),
    } : null,
  })) });
}

export async function POST(request: NextRequest) {
  if (!env.DB) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });
  const companyId = request.nextUrl.searchParams.get("companyId") || "";
  if (!companyId) return NextResponse.json({ error: "companyId required" }, { status: 400 });
  const now = new Date().toISOString();
  const id = `wl-${companyId}-${now.slice(0, 10)}`;
  await env.DB.prepare(
    `INSERT INTO buyer_watchlist (id, company_id, status, notes, created_at, updated_at)
     VALUES (?,?,?,?,?,?) ON CONFLICT(company_id) DO NOTHING`,
  ).bind(id, companyId, "new", "", now, now).run();
  const saved = await env.DB.prepare("SELECT * FROM buyer_watchlist WHERE company_id = ?").bind(companyId).all();
  const row = (saved.results || [])[0];
  if (!row) return NextResponse.json({ error: "failed to save" }, { status: 500 });
  return NextResponse.json(mapWatchlistRow(row), { status: 201 });
}

interface WatchlistPatch {
  id?: string;
  status?: string;
  notes?: string;
  leadStatus?: string;
  outreachStrategy?: string;
  recommendedProducts?: string;
  confidence?: string;
  commercialFitScore?: number;
  outreachScore?: number;
  opportunityValueUsd?: number;
  opportunityProbability?: number;
  expectedCloseDate?: string;
}

export async function PATCH(request: NextRequest) {
  if (!env.DB) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });
  const body = await request.json().catch(() => null) as WatchlistPatch | null;
  const id = body?.id || request.nextUrl.searchParams.get("id") || "";
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const validStatus = body?.status === undefined || STATUSES.has(body.status);
  if (!validStatus) return NextResponse.json({ error: "invalid status" }, { status: 400 });
  const validLeadStatus = body?.leadStatus === undefined || LEAD_STATUSES.has(body.leadStatus);
  if (!validLeadStatus) return NextResponse.json({ error: "invalid lead_status" }, { status: 400 });
  if (body?.opportunityValueUsd !== undefined && !validateOpportunityValue(body.opportunityValueUsd)) return NextResponse.json({ error: "invalid opportunity_value_usd" }, { status: 400 });
  if (body?.opportunityProbability !== undefined && !validateOpportunityProbability(body.opportunityProbability)) return NextResponse.json({ error: "invalid opportunity_probability" }, { status: 400 });
  if (body?.expectedCloseDate !== undefined && !validateExpectedCloseDate(body.expectedCloseDate)) return NextResponse.json({ error: "invalid expected_close_date" }, { status: 400 });

  const hasUpdate = (body?.status !== undefined || body?.notes !== undefined ||
    body?.leadStatus !== undefined || body?.outreachStrategy !== undefined ||
    body?.recommendedProducts !== undefined || body?.confidence !== undefined ||
    body?.commercialFitScore !== undefined || body?.outreachScore !== undefined ||
    body?.opportunityValueUsd !== undefined || body?.opportunityProbability !== undefined ||
    body?.expectedCloseDate !== undefined);
  if (!hasUpdate) return NextResponse.json({ error: "nothing to update" }, { status: 400 });

  const now = new Date().toISOString();
  const set: string[] = [];
  const args: unknown[] = [];

  if (body?.status !== undefined) { set.push("status=?"); args.push(body.status); }
  if (body?.notes !== undefined) { set.push("notes=?"); args.push(body.notes); }
  if (body?.leadStatus !== undefined) { set.push("lead_status=?"); args.push(body.leadStatus); }
  if (body?.outreachStrategy !== undefined) { set.push("outreach_strategy=?"); args.push(body.outreachStrategy); }
  if (body?.recommendedProducts !== undefined) { set.push("recommended_products=?"); args.push(body.recommendedProducts); }
  if (body?.confidence !== undefined) { set.push("confidence=?"); args.push(body.confidence); }
  if (body?.commercialFitScore !== undefined) { set.push("commercial_fit_score=?"); args.push(body.commercialFitScore); }
  if (body?.outreachScore !== undefined) { set.push("outreach_score=?"); args.push(body.outreachScore); }
  if (body?.opportunityValueUsd !== undefined) { set.push("opportunity_value_usd=?"); args.push(body.opportunityValueUsd); }
  if (body?.opportunityProbability !== undefined) { set.push("opportunity_probability=?"); args.push(body.opportunityProbability); }
  if (body?.expectedCloseDate !== undefined) { set.push("expected_close_date=?"); args.push(body.expectedCloseDate); }

  set.push("updated_at=?");
  args.push(now, id);

  const result = await env.DB.prepare(
    `UPDATE buyer_watchlist SET ${set.join(", ")} WHERE id=?`,
  ).bind(...args).run();
  if (!result.meta?.changes) return NextResponse.json({ error: "not found" }, { status: 404 });
  if (body?.leadStatus === "disqualified") {
    const saved = await env.DB.prepare("SELECT company_id FROM buyer_watchlist WHERE id=?").bind(id).all();
    const companyId = (saved.results || [])[0]?.company_id;
    if (companyId) await env.DB.prepare("UPDATE lead_actions SET next_action_due=NULL WHERE company_id=? AND next_action_due IS NOT NULL").bind(companyId).run();
  }

  const row = await env.DB.prepare("SELECT * FROM buyer_watchlist WHERE id = ?").bind(id).all();
  return NextResponse.json(mapWatchlistRow((row.results || [])[0] || {}));
}

export async function DELETE(request: NextRequest) {
  if (!env.DB) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });
  const id = request.nextUrl.searchParams.get("id") || "";
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  await env.DB.prepare("DELETE FROM buyer_watchlist WHERE id = ?").bind(id).run();
  return NextResponse.json({ ok: true });
}

function mapWatchlistRow(row: Record<string, unknown>) {
  return {
    id: String(row.id || ""),
    companyId: String(row.company_id || ""),
    status: String(row.status || "new"),
    notes: String(row.notes || ""),
    leadStatus: row.lead_status ? String(row.lead_status) : null,
    outreachStrategy: row.outreach_strategy ? String(row.outreach_strategy) : null,
    recommendedProducts: row.recommended_products ? String(row.recommended_products) : null,
    confidence: row.confidence ? String(row.confidence) : null,
    commercialFitScore: row.commercial_fit_score != null ? Number(row.commercial_fit_score) : null,
    outreachScore: row.outreach_score != null ? Number(row.outreach_score) : null,
    opportunityValueUsd: row.opportunity_value_usd != null ? Number(row.opportunity_value_usd) : null,
    opportunityProbability: row.opportunity_probability != null ? Number(row.opportunity_probability) : null,
    expectedCloseDate: row.expected_close_date ? String(row.expected_close_date) : null,
    createdAt: String(row.created_at || ""),
    updatedAt: String(row.updated_at || ""),
  };
}
