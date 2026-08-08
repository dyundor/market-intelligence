import type { DbLike } from "../db/types.ts";
import type { LeadRecord } from "../qualification/types.ts";
import { qualifyBuyer } from "../qualification/factors.ts";
import { resolveProduct } from "../products/resolver.ts";
import { generateLeadStrategy } from "./strategy.ts";

export interface TopBuyerEntry {
  buyerId: string;
  rank: number;
  metric: string;
  metricValue: number;
  entity: Record<string, unknown>;
}

export class LeadInitializer {
  private readonly db: DbLike;

  constructor(db: DbLike) {
    this.db = db;
  }

  async getTopBuyers(metric = "shipment_count", limit = 10): Promise<TopBuyerEntry[]> {
    const latest = await this.db
      .prepare(
        `SELECT year, month FROM buyer_monthly_rankings
         WHERE metric = ? ORDER BY year DESC, month DESC LIMIT 1`,
      )
      .bind(metric)
      .all();
    const monthRow = (latest.results || [])[0];
    if (!monthRow) return [];
    const year = Number(monthRow.year);
    const month = Number(monthRow.month);

    const ranks = await this.db
      .prepare(
        `SELECT r.buyer_id, r.rank, r.metric, r.metric_value
         FROM buyer_monthly_rankings r
         WHERE r.metric = ? AND r.year = ? AND r.month = ?
         ORDER BY r.rank ASC LIMIT ?`,
      )
      .bind(metric, year, month, limit)
      .all();

    const buyers: TopBuyerEntry[] = [];
    for (const rankRow of (ranks.results || [])) {
      const entityResult = await this.db
        .prepare("SELECT * FROM importyeti_web_entities WHERE id = ?")
        .bind(String(rankRow.buyer_id))
        .all();
      const entity = (entityResult.results || [])[0];
      if (!entity) continue;
      buyers.push({
        buyerId: String(rankRow.buyer_id),
        rank: Number(rankRow.rank),
        metric: String(rankRow.metric),
        metricValue: Number(rankRow.metric_value),
        entity,
      });
    }
    return buyers;
  }

  async getEvidenceBuyers(limit = 25): Promise<TopBuyerEntry[]> {
    const result = await this.db.prepare(
      `SELECT e.*,
        COALESCE(SUM(CASE WHEN r.hs_codes LIKE '%8481.80%' OR lower(COALESCE(r.product_descriptions,'')) LIKE '%faucet%' OR lower(COALESCE(r.product_descriptions,'')) LIKE '%shower%' THEN COALESCE(r.shipment_count,0) ELSE 0 END),0) evidence_shipments,
        COUNT(DISTINCT r.supplier_id) evidence_suppliers,
        MAX(r.period_end) evidence_latest_date
       FROM importyeti_web_entities e
       JOIN importyeti_web_relationships r ON r.importer_id=e.id
       WHERE e.entity_type='importer' AND e.id NOT LIKE 'seed-%'
       GROUP BY e.id
       HAVING evidence_shipments>0
       ORDER BY CASE e.identity_status WHEN 'source_verified' THEN 0 ELSE 1 END,
         COALESCE(e.identity_confidence,0) DESC,evidence_shipments DESC,e.name
       LIMIT ?`,
    ).bind(limit).all();
    return (result.results||[]).map((entity,index)=>({buyerId:String(entity.id),rank:index+1,metric:"relationship_shipment_count",metricValue:Number(entity.evidence_shipments||0),entity}));
  }

  buildQualificationRow(entry: TopBuyerEntry): Record<string, unknown> {
    const e = entry.entity;
    const row: Record<string, unknown> = {
      id: e.id,
      name: e.name,
      total_shipments: e.total_shipments ?? e.evidence_shipments,
      latest_shipment_date: e.latest_shipment_date ?? e.evidence_latest_date,
      identity_confidence: e.identity_confidence,
      website_status: e.website_status,
      entity_type: e.entity_type,
      search_query: e.search_query,
      products: e.search_query,
    };

    const productCategory = resolveProduct(
      String(e.search_query || "龙头及阀类"),
    );

    return { ...row, productCategory };
  }

  async enrichWithRelationships(row: Record<string, unknown>): Promise<Record<string, unknown>> {
    const id = String(row.id || "");
    if (!id) return row;

    const relResult = await this.db
      .prepare(
        `SELECT r.supplier_id, r.shipment_count, r.product_descriptions,
          s.name supplier_name, s.country supplier_country
         FROM importyeti_web_relationships r
         LEFT JOIN importyeti_web_entities s ON s.id = r.supplier_id
         WHERE r.importer_id = ? ORDER BY r.shipment_count DESC`,
      )
      .bind(id)
      .all();

    const rels = relResult.results || [];
    const supplierNames: string[] = [];
    const productDescriptions: string[] = [];

    for (const rel of rels) {
      if (rel.supplier_name) supplierNames.push(String(rel.supplier_name));
      if (rel.product_descriptions) {
        const desc = String(rel.product_descriptions);
        for (const d of desc.split(/[;,]/)) {
          const trimmed = d.trim();
          if (trimmed) productDescriptions.push(trimmed);
        }
      }
    }

    return {
      ...row,
      supplier_count: rels.length,
      supplierNames: [...new Set(supplierNames)],
      productDescriptions: [...new Set(productDescriptions)],
    };
  }

  async generateLeadRecord(entry: TopBuyerEntry): Promise<LeadRecord> {
    const baseRow = this.buildQualificationRow(entry);
    const row = await this.enrichWithRelationships(baseRow);
    return this.generateLeadRecordSync(row);
  }

  private generateLeadRecordSync(row: Record<string, unknown>): LeadRecord {
    const productCategory = row.productCategory as
      | { id: string; keywords: string[]; aliases: string[]; excludeKeywords: string[] }
      | undefined;

    const context = productCategory
      ? {
          productCategory: productCategory.id,
          productKeywords: [...productCategory.keywords, ...productCategory.aliases],
          excludeKeywords: productCategory.excludeKeywords || [],
        }
      : undefined;

    const qualification = qualifyBuyer(row, context);
    return generateLeadStrategy(qualification, row);
  }

  async initializeLead(
    companyId: string,
    leadRecord: LeadRecord,
  ): Promise<boolean> {
    const now = new Date().toISOString();
    const id = `wl-${companyId}-${now.slice(0, 10)}`;
    const result = await this.db
      .prepare(
        `INSERT INTO buyer_watchlist (id, company_id, status, notes,
          lead_status, outreach_strategy, recommended_products, confidence,
          commercial_fit_score, outreach_score, created_at, updated_at)
         VALUES (?,?,?,?,
          ?,?,?,?,
          ?,?,?,?)
         ON CONFLICT(company_id) DO UPDATE SET
          lead_status=CASE WHEN buyer_watchlist.lead_status IN ('contact_ready','contacted','follow_up','qualified','opportunity') THEN buyer_watchlist.lead_status ELSE excluded.lead_status END,
          outreach_strategy=excluded.outreach_strategy,
          recommended_products=excluded.recommended_products,
          confidence=excluded.confidence,
          commercial_fit_score=excluded.commercial_fit_score,
          outreach_score=excluded.outreach_score,
          updated_at=excluded.updated_at`,
      )
      .bind(
        id, companyId, "new", "",
        leadRecord.leadStatus, leadRecord.outreachStrategy,
        leadRecord.recommendedProducts, leadRecord.confidence,
        leadRecord.commercialFitScore, leadRecord.outreachScore,
        now, now,
      )
      .run();
    return (result as { meta?: { changes?: number } }).meta?.changes != null;
  }
}
