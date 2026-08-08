import { NextRequest, NextResponse } from "next/server";
import { env } from "cloudflare:workers";

const STATUSES = new Set(["new", "contacted", "follow_up", "customer"]);

export async function GET(request: NextRequest) {
  if (!env.DB) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });
  const rows = await env.DB.prepare(
    `SELECT w.id,w.company_id,w.status,w.notes,w.created_at,w.updated_at,
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
  return NextResponse.json({
    id: String(row.id),
    companyId: String(row.company_id),
    status: String(row.status),
    notes: String(row.notes || ""),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  }, { status: 201 });
}

export async function PATCH(request: NextRequest) {
  if (!env.DB) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });
  const body = await request.json().catch(() => null) as { id?: string; status?: string; notes?: string } | null;
  const id = body?.id || request.nextUrl.searchParams.get("id") || "";
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  const status = body?.status;
  if (status !== undefined && !STATUSES.has(status)) return NextResponse.json({ error: "invalid status" }, { status: 400 });
  if (status === undefined && body?.notes === undefined) return NextResponse.json({ error: "nothing to update" }, { status: 400 });
  const now = new Date().toISOString();
  const set: string[] = [];
  const args: unknown[] = [];
  if (status !== undefined) { set.push("status=?"); args.push(status); }
  if (body?.notes !== undefined) { set.push("notes=?"); args.push(body.notes); }
  set.push("updated_at=?");
  args.push(now, id);
  const result = await env.DB.prepare(`UPDATE buyer_watchlist SET ${set.join(", ")} WHERE id=?`).bind(...args).run();
  if (!result.meta?.changes) return NextResponse.json({ error: "not found" }, { status: 404 });
  const row = await env.DB.prepare("SELECT * FROM buyer_watchlist WHERE id = ?").bind(id).all();
  const saved = (row.results || [])[0];
  return NextResponse.json({
    id: String(saved.id),
    companyId: String(saved.company_id),
    status: String(saved.status),
    notes: String(saved.notes || ""),
    createdAt: String(saved.created_at),
    updatedAt: String(saved.updated_at),
  });
}

export async function DELETE(request: NextRequest) {
  if (!env.DB) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });
  const id = request.nextUrl.searchParams.get("id") || "";
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  await env.DB.prepare("DELETE FROM buyer_watchlist WHERE id = ?").bind(id).run();
  return NextResponse.json({ ok: true });
}
