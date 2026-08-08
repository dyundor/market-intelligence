import type { DbLike } from "../db/types.ts";

export interface LeadContactRow {
  id: string;
  companyId: string;
  contactType: "email" | "phone" | "linkedin" | "website_contact_page";
  contactValue: string;
  label: string | null;
  sourceUrl: string;
  sourceType: "manual" | "linkedin_api" | "website_scrape";
  verifiedAt: string | null;
  verificationStatus: "unverified" | "verified" | "bounced";
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export interface LeadActionRow {
  id: string;
  companyId: string;
  actionType: string;
  direction: "outbound" | "inbound";
  channel: string | null;
  summary: string;
  outcome: string | null;
  nextAction: string | null;
  nextActionDue: string | null;
  performedBy: string;
  createdAt: string;
}

export interface OutreachDraftRow {
  id: string;
  companyId: string;
  channel: "email" | "linkedin";
  subject: string;
  body: string;
  status: "draft" | "approved" | "sent" | "archived";
  evidenceSummary: string;
  personalizationNotes: string;
  createdAt: string;
  updatedAt: string;
}

function mapContactRow(row: Record<string, unknown>): LeadContactRow {
  return {
    id: String(row.id || ""),
    companyId: String(row.company_id || ""),
    contactType: String(row.contact_type || "email") as LeadContactRow["contactType"],
    contactValue: String(row.contact_value || ""),
    label: row.label ? String(row.label) : null,
    sourceUrl: String(row.source_url || ""),
    sourceType: String(row.source_type || "manual") as LeadContactRow["sourceType"],
    verifiedAt: row.verified_at ? String(row.verified_at) : null,
    verificationStatus: String(row.verification_status || "unverified") as LeadContactRow["verificationStatus"],
    notes: String(row.notes || ""),
    createdAt: String(row.created_at || ""),
    updatedAt: String(row.updated_at || ""),
  };
}

function mapActionRow(row: Record<string, unknown>): LeadActionRow {
  return {
    id: String(row.id || ""),
    companyId: String(row.company_id || ""),
    actionType: String(row.action_type || ""),
    direction: String(row.direction || "outbound") as LeadActionRow["direction"],
    channel: row.channel ? String(row.channel) : null,
    summary: String(row.summary || ""),
    outcome: row.outcome ? String(row.outcome) : null,
    nextAction: row.next_action ? String(row.next_action) : null,
    nextActionDue: row.next_action_due ? String(row.next_action_due) : null,
    performedBy: String(row.performed_by || "manual"),
    createdAt: String(row.created_at || ""),
  };
}

function mapDraftRow(row: Record<string, unknown>): OutreachDraftRow {
  return {
    id: String(row.id || ""),
    companyId: String(row.company_id || ""),
    channel: String(row.channel || "email") as OutreachDraftRow["channel"],
    subject: String(row.subject || ""),
    body: String(row.body || ""),
    status: String(row.status || "draft") as OutreachDraftRow["status"],
    evidenceSummary: String(row.evidence_summary || ""),
    personalizationNotes: String(row.personalization_notes || ""),
    createdAt: String(row.created_at || ""),
    updatedAt: String(row.updated_at || ""),
  };
}

export class LeadRepository {
  private readonly db: DbLike;

  constructor(db: DbLike) {
    this.db = db;
  }

  async listContacts(companyId: string): Promise<LeadContactRow[]> {
    const result = await this.db
      .prepare(
        `SELECT id, company_id, contact_type, contact_value, label, source_url, source_type,
          verified_at, verification_status, notes, created_at, updated_at
         FROM lead_contacts WHERE company_id = ? ORDER BY verified_at DESC NULLS LAST, created_at DESC`,
      )
      .bind(companyId)
      .all();
    return (result.results || []).map(mapContactRow);
  }

  async createContact(row: Omit<LeadContactRow, "id" | "createdAt" | "updatedAt">): Promise<LeadContactRow> {
    const now = new Date().toISOString();
    const id = `lc-${row.companyId}-${row.contactType}-${Date.now()}`;
    await this.db
      .prepare(
        `INSERT INTO lead_contacts (id, company_id, contact_type, contact_value, label, source_url, source_type,
          verified_at, verification_status, notes, created_at, updated_at)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?)
         ON CONFLICT(company_id, contact_type, contact_value)
         DO UPDATE SET label=excluded.label, source_url=excluded.source_url,
           verification_status=excluded.verification_status, updated_at=excluded.updated_at`,
      )
      .bind(
        id, row.companyId, row.contactType, row.contactValue, row.label ?? null,
        row.sourceUrl, row.sourceType, row.verifiedAt ?? null,
        row.verificationStatus, row.notes, now, now,
      )
      .run();

    const saved = await this.db
      .prepare("SELECT * FROM lead_contacts WHERE company_id = ? AND contact_type = ? AND contact_value = ?")
      .bind(row.companyId, row.contactType, row.contactValue)
      .all();
    const contact = mapContactRow((saved.results || [])[0] || {});
    if (contact.verificationStatus === "verified") {
      await this.markContactReady(contact.companyId);
    }
    return contact;
  }

  async updateContact(id: string, updates: Partial<Pick<LeadContactRow, "label" | "verifiedAt" | "verificationStatus" | "notes">>): Promise<LeadContactRow | null> {
    const now = new Date().toISOString();
    const set: string[] = ["updated_at = ?"];
    const args: unknown[] = [now];

    if (updates.label !== undefined) { set.push("label = ?"); args.push(updates.label); }
    if (updates.verifiedAt !== undefined) { set.push("verified_at = ?"); args.push(updates.verifiedAt); }
    if (updates.verificationStatus !== undefined) { set.push("verification_status = ?"); args.push(updates.verificationStatus); }
    if (updates.notes !== undefined) { set.push("notes = ?"); args.push(updates.notes); }

    args.push(id);
    await this.db
      .prepare(`UPDATE lead_contacts SET ${set.join(", ")} WHERE id = ?`)
      .bind(...args)
      .run();

    const result = await this.db
      .prepare("SELECT * FROM lead_contacts WHERE id = ?")
      .bind(id)
      .all();
    const row = (result.results || [])[0];
    const contact = row ? mapContactRow(row) : null;
    if (contact?.verificationStatus === "verified") {
      await this.markContactReady(contact.companyId);
    }
    return contact;
  }

  async deleteContact(id: string): Promise<boolean> {
    const result = await this.db
      .prepare("DELETE FROM lead_contacts WHERE id = ?")
      .bind(id)
      .run() as { meta?: { changes?: number } };
    return (result?.meta?.changes ?? 0) > 0;
  }

  async listActions(companyId: string): Promise<LeadActionRow[]> {
    const result = await this.db
      .prepare(
        `SELECT id, company_id, action_type, direction, channel, summary, outcome,
          next_action, next_action_due, performed_by, created_at
         FROM lead_actions WHERE company_id = ? ORDER BY created_at DESC`,
      )
      .bind(companyId)
      .all();
    return (result.results || []).map(mapActionRow);
  }

  async createAction(row: Omit<LeadActionRow, "id" | "createdAt">): Promise<LeadActionRow> {
    const now = new Date().toISOString();
    const id = `la-${row.companyId}-${Date.now()}`;
    await this.db
      .prepare(
        `INSERT INTO lead_actions (id, company_id, action_type, direction, channel, summary, outcome,
          next_action, next_action_due, performed_by, created_at)
         VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
      )
      .bind(
        id, row.companyId, row.actionType, row.direction, row.channel ?? null,
        row.summary, row.outcome ?? null, row.nextAction ?? null,
        row.nextActionDue ?? null, row.performedBy, now,
      )
      .run();

    const saved = await this.db
      .prepare("SELECT * FROM lead_actions WHERE id = ?")
      .bind(id)
      .all();
    return mapActionRow((saved.results || [])[0] || {});
  }

  async listDrafts(companyId: string): Promise<OutreachDraftRow[]> {
    const result = await this.db
      .prepare("SELECT * FROM lead_outreach_drafts WHERE company_id = ? ORDER BY updated_at DESC")
      .bind(companyId)
      .all();
    return (result.results || []).map(mapDraftRow);
  }

  async createDraft(row: Omit<OutreachDraftRow, "id" | "createdAt" | "updatedAt">): Promise<OutreachDraftRow> {
    const now = new Date().toISOString();
    const id = `lod-${row.companyId}-${Date.now()}`;
    await this.db.prepare(
      `INSERT INTO lead_outreach_drafts
       (id, company_id, channel, subject, body, status, evidence_summary, personalization_notes, created_at, updated_at)
       VALUES (?,?,?,?,?,?,?,?,?,?)`,
    ).bind(id, row.companyId, row.channel, row.subject, row.body, row.status, row.evidenceSummary, row.personalizationNotes, now, now).run();
    const saved = await this.db.prepare("SELECT * FROM lead_outreach_drafts WHERE id = ?").bind(id).all();
    return mapDraftRow((saved.results || [])[0] || {});
  }

  async updateDraft(id: string, updates: Partial<Pick<OutreachDraftRow, "subject" | "body" | "status">>): Promise<OutreachDraftRow | null> {
    const set: string[] = ["updated_at = ?"];
    const args: unknown[] = [new Date().toISOString()];
    if (updates.subject !== undefined) { set.push("subject = ?"); args.push(updates.subject); }
    if (updates.body !== undefined) { set.push("body = ?"); args.push(updates.body); }
    if (updates.status !== undefined) { set.push("status = ?"); args.push(updates.status); }
    args.push(id);
    await this.db.prepare(`UPDATE lead_outreach_drafts SET ${set.join(", ")} WHERE id = ?`).bind(...args).run();
    const result = await this.db.prepare("SELECT * FROM lead_outreach_drafts WHERE id = ?").bind(id).all();
    const row = (result.results || [])[0];
    return row ? mapDraftRow(row) : null;
  }

  private async markContactReady(companyId: string): Promise<void> {
    await this.db
      .prepare(
        `UPDATE buyer_watchlist
         SET lead_status = 'contact_ready', updated_at = ?
         WHERE company_id = ? AND lead_status IN ('new', 'researching')`,
      )
      .bind(new Date().toISOString(), companyId)
      .run();
  }
}
