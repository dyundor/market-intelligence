import { NextRequest, NextResponse } from "next/server";
import { env } from "cloudflare:workers";
import { LeadRepository } from "../../../lib/repositories/lead-repository.ts";

const CONTACT_TYPES = new Set(["email", "phone", "linkedin", "website_contact_page"]);
const SOURCE_TYPES = new Set(["manual", "linkedin_api", "website_scrape"]);
const VERIFICATION_STATUSES = new Set(["unverified", "verified", "bounced"]);

export async function GET(request: NextRequest) {
  if (!env.DB) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });
  const companyId = request.nextUrl.searchParams.get("companyId") || "";
  if (!companyId) return NextResponse.json({ error: "companyId required" }, { status: 400 });
  const repo = new LeadRepository(env.DB);
  const contacts = await repo.listContacts(companyId);
  return NextResponse.json({ items: contacts });
}

export async function POST(request: NextRequest) {
  if (!env.DB) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!body?.companyId || !body?.contactValue || !body?.sourceUrl) {
    return NextResponse.json({ error: "companyId, contactValue, and sourceUrl required" }, { status: 400 });
  }
  const contactType = String(body.contactType || "email");
  if (!CONTACT_TYPES.has(contactType)) {
    return NextResponse.json({ error: `invalid contactType: ${contactType}` }, { status: 400 });
  }
  const sourceType = String(body.sourceType || "manual");
  if (!SOURCE_TYPES.has(sourceType)) {
    return NextResponse.json({ error: `invalid sourceType: ${sourceType}` }, { status: 400 });
  }
  const verificationStatus = String(body.verificationStatus || "unverified");
  if (!VERIFICATION_STATUSES.has(verificationStatus)) {
    return NextResponse.json({ error: `invalid verificationStatus: ${verificationStatus}` }, { status: 400 });
  }

  const repo = new LeadRepository(env.DB);
  const contact = await repo.createContact({
    companyId: String(body.companyId),
    contactType: contactType as "email" | "phone" | "linkedin" | "website_contact_page",
    contactValue: String(body.contactValue),
    label: body.label ? String(body.label) : null,
    sourceUrl: String(body.sourceUrl || ""),
    sourceType: sourceType as "manual" | "linkedin_api" | "website_scrape",
    verifiedAt: body.verifiedAt ? String(body.verifiedAt) : null,
    verificationStatus: verificationStatus as "unverified" | "verified" | "bounced",
    notes: String(body.notes || ""),
  });
  return NextResponse.json(contact, { status: 201 });
}

export async function PATCH(request: NextRequest) {
  if (!env.DB) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  const rawId = body?.id || request.nextUrl.searchParams.get("id") || "";
  const id = String(rawId);
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  if (body?.verificationStatus != null && !VERIFICATION_STATUSES.has(String(body.verificationStatus))) {
    return NextResponse.json({ error: `invalid verificationStatus: ${String(body.verificationStatus)}` }, { status: 400 });
  }

  const repo = new LeadRepository(env.DB);
  const contact = await repo.updateContact(id, {
    label: body?.label != null ? String(body.label) : undefined,
    verifiedAt: body?.verifiedAt != null ? String(body.verifiedAt) : undefined,
    verificationStatus: (body?.verificationStatus != null ? String(body.verificationStatus) : undefined) as "unverified" | "verified" | "bounced" | undefined,
    notes: body?.notes != null ? String(body.notes) : undefined,
  });
  if (!contact) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json(contact);
}

export async function DELETE(request: NextRequest) {
  if (!env.DB) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });
  const id = request.nextUrl.searchParams.get("id") || "";
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  const repo = new LeadRepository(env.DB);
  const deleted = await repo.deleteContact(id);
  if (!deleted) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
