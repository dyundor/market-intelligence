import { NextRequest, NextResponse } from "next/server";
import { env } from "cloudflare:workers";

export async function GET(request: NextRequest) {
  if (!env.DB) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });

  const limit = Math.min(Math.max(Number(request.nextUrl.searchParams.get("limit") || "10"), 1), 50);
  const metric = request.nextUrl.searchParams.get("metric") || "shipment_count";

  const latestMonth = await env.DB.prepare(
    `SELECT year, month FROM buyer_monthly_rankings
     WHERE metric = ? ORDER BY year DESC, month DESC LIMIT 1`,
  ).bind(metric).all();
  const monthRow = (latestMonth.results || [])[0];
  const year = monthRow ? Number(monthRow.year) : 2026;
  const month = monthRow ? Number(monthRow.month) : 8;

  const rows = await env.DB.prepare(
    `SELECT r.buyer_id, r.rank, r.metric, r.metric_value,
      e.name company_name, e.country, e.country_code, e.entity_type,
      e.total_shipments, e.latest_shipment_date, e.website,
      e.city_name, e.admin1_name, e.identity_confidence,
      e.contact_data_status,
      w.id watchlist_id, w.status watchlist_status,
      w.lead_status, w.outreach_strategy, w.recommended_products,
      w.confidence, w.commercial_fit_score, w.outreach_score,
      w.notes watchlist_notes,
      (SELECT COUNT(*) FROM lead_contacts lc WHERE lc.company_id = r.buyer_id) contact_count,
      (SELECT COUNT(*) FROM lead_actions la WHERE la.company_id = r.buyer_id) action_count
     FROM buyer_monthly_rankings r
     JOIN importyeti_web_entities e ON e.id = r.buyer_id
     LEFT JOIN buyer_watchlist w ON w.company_id = r.buyer_id
     WHERE r.metric = ? AND r.year = ? AND r.month = ?
     ORDER BY r.rank ASC
     LIMIT ?`,
  ).bind(metric, year, month, limit).all();

  const leads = (rows.results || []).map(row => ({
    buyerId: String(row.buyer_id),
    rank: Number(row.rank),
    metric: String(row.metric),
    metricValue: Number(row.metric_value),
    company: {
      name: String(row.company_name || ""),
      country: String(row.country || ""),
      countryCode: row.country_code ? String(row.country_code) : null,
      entityType: String(row.entity_type || ""),
      totalShipments: row.total_shipments == null ? null : Number(row.total_shipments),
      latestShipmentDate: row.latest_shipment_date ? String(row.latest_shipment_date) : null,
      website: row.website ? String(row.website) : null,
      location: [String(row.city_name || ""), String(row.admin1_name || "")].filter(Boolean).join(", ") || null,
      identityConfidence: row.identity_confidence != null ? Number(row.identity_confidence) : null,
      contactDataStatus: String(row.contact_data_status || "not_available"),
    },
    watchlist: row.watchlist_id ? {
      id: String(row.watchlist_id),
      status: String(row.watchlist_status || "new"),
      leadStatus: row.lead_status ? String(row.lead_status) : null,
      outreachStrategy: row.outreach_strategy ? String(row.outreach_strategy) : null,
      recommendedProducts: row.recommended_products ? String(row.recommended_products) : null,
      confidence: row.confidence ? String(row.confidence) : null,
      commercialFitScore: row.commercial_fit_score != null ? Number(row.commercial_fit_score) : null,
      outreachScore: row.outreach_score != null ? Number(row.outreach_score) : null,
      notes: String(row.watchlist_notes || ""),
    } : null,
    contactCount: Number(row.contact_count || 0),
    actionCount: Number(row.action_count || 0),
  }));

  return NextResponse.json({
    items: leads,
    meta: {
      metric,
      year,
      month,
      limit,
      total: leads.length,
    },
  });
}
