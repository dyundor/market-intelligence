import type { DbLike } from "../db/types.ts";
import type { BuyerSupplierRelationship } from "../relationships/types.ts";

const DEFAULT_TABLE = "buyer_supplier_relationships";

export interface RelationshipQuery {
  buyerId?: string;
  supplierId?: string;
  productCategory?: string;
  limit?: number;
}

export class RelationshipRepository {
  private readonly db: DbLike;
  private readonly table: string;

  constructor(db: DbLike, options: { table?: string } = {}) {
    this.db = db;
    this.table = options.table || DEFAULT_TABLE;
  }

  async save(relationships: BuyerSupplierRelationship[]): Promise<number> {
    let saved = 0;
    for (const relationship of relationships) {
      if (!relationship.buyerId || !relationship.supplierId) continue;
      const id = `${relationship.buyerId}:${relationship.supplierId}:${relationship.productCategory}`;
      await this.db
        .prepare(
          `INSERT INTO ${this.table} (id, buyer_id, supplier_id, product_category, shipment_count, first_seen, last_seen, source, updated_at) VALUES (?,?,?,?,?,?,?,?,?)
           ON CONFLICT(id) DO UPDATE SET shipment_count=excluded.shipment_count, first_seen=excluded.first_seen, last_seen=excluded.last_seen, source=excluded.source, updated_at=excluded.updated_at`,
        )
        .bind(
          id,
          relationship.buyerId,
          relationship.supplierId,
          relationship.productCategory,
          relationship.shipmentCount,
          relationship.firstSeen,
          relationship.lastSeen,
          relationship.source,
          new Date().toISOString(),
        )
        .run();
      saved += 1;
    }
    return saved;
  }

  async query(spec: RelationshipQuery = {}): Promise<BuyerSupplierRelationship[]> {
    const clauses: string[] = [];
    const args: unknown[] = [];
    if (spec.buyerId) {
      clauses.push("buyer_id = ?");
      args.push(spec.buyerId);
    }
    if (spec.supplierId) {
      clauses.push("supplier_id = ?");
      args.push(spec.supplierId);
    }
    if (spec.productCategory) {
      clauses.push("product_category = ?");
      args.push(spec.productCategory);
    }
    const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
    const limit = spec.limit ? `LIMIT ${spec.limit}` : "";
    const result = await this.db
      .prepare(`SELECT buyer_id, supplier_id, product_category, shipment_count, first_seen, last_seen, source FROM ${this.table} ${where} ORDER BY shipment_count DESC ${limit}`)
      .bind(...args)
      .all();
    return (result.results || []).map(row => ({
      buyerId: String(row.buyer_id || ""),
      supplierId: String(row.supplier_id || ""),
      productCategory: String(row.product_category || "unknown"),
      shipmentCount: Number(row.shipment_count || 0),
      firstSeen: row.first_seen ? String(row.first_seen) : null,
      lastSeen: row.last_seen ? String(row.last_seen) : null,
      source: String(row.source || "unknown"),
    }));
  }
}
