import type { DbLike } from "../db/types.ts";
import type { Shipment } from "../entities/shipment.ts";
import { shipmentFromRow } from "../entities/shipment.ts";
import { resolveProduct } from "../products/resolver.ts";

const DEFAULT_TABLE = "importyeti_web_shipments";

export interface ShipmentQuery {
  market?: string;
  product?: string;
  months?: string[];
  importerId?: string;
  supplierId?: string;
  limit?: number;
}

function monthClause(months: string[]): { sql: string; args: string[] } {
  if (!months.length) return { sql: "", args: [] };
  const placeholders = months.map(() => "?").join(",");
  return { sql: `AND substr(shipment_date, 1, 7) IN (${placeholders})`, args: months };
}

function productKeyword(product: string): string {
  const category = resolveProduct(product);
  return category?.keywords[0] || product.toLowerCase();
}

export class ShipmentRepository {
  private readonly db: DbLike;
  private readonly table: string;

  constructor(db: DbLike, options: { table?: string } = {}) {
    this.db = db;
    this.table = options.table || DEFAULT_TABLE;
  }

  async save(shipments: Shipment[]): Promise<number> {
    let saved = 0;
    for (const shipment of shipments) {
      if (!shipment.importerName || !shipment.shipmentDate) continue;
      const id = shipment.id || `${shipment.source}:${shipment.sourceShipmentId}`;
      await this.db
        .prepare(
          `INSERT INTO ${this.table} (id, supplier_id, importer_id, importer_name, shipment_date, weight_kg, quantity, container_count, product_description, source_url, source_channel, captured_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO NOTHING`,
        )
        .bind(
          id,
          shipment.supplierId,
          shipment.importerId,
          shipment.importerName,
          shipment.shipmentDate,
          shipment.weight,
          shipment.quantity,
          shipment.containerCount,
          shipment.productKeywords.join(", ") || "",
          shipment.sourceUrl || "",
          shipment.source || "importyeti_free_web",
          new Date().toISOString(),
        )
        .run();
      saved += 1;
    }
    return saved;
  }

  private async runQuery(where: string, args: unknown[]): Promise<Shipment[]> {
    const sql = `SELECT * FROM ${this.table} WHERE 1=1 ${where} ORDER BY shipment_date DESC`;
    const result = await this.db.prepare(sql).bind(...args).all();
    const rows = (result?.results || []) as Array<Record<string, unknown>>;
    return rows.map(row => shipmentFromRow(row));
  }

  async findByProduct(product: string, months: string[] = []): Promise<Shipment[]> {
    const month = monthClause(months);
    return this.runQuery(`AND product_description LIKE ? ${month.sql}`, [`%${productKeyword(product)}%`, ...month.args]);
  }

  async findByImporter(importerId: string, months: string[] = []): Promise<Shipment[]> {
    const month = monthClause(months);
    return this.runQuery(`AND importer_id = ? ${month.sql}`, [importerId, ...month.args]);
  }

  async findBySupplier(supplierId: string, months: string[] = []): Promise<Shipment[]> {
    const month = monthClause(months);
    return this.runQuery(`AND supplier_id = ? ${month.sql}`, [supplierId, ...month.args]);
  }

  async findByMonth(months: string[]): Promise<Shipment[]> {
    const month = monthClause(months);
    return this.runQuery(month.sql, month.args);
  }

  async query(spec: ShipmentQuery): Promise<Shipment[]> {
    const clauses: string[] = [];
    const args: unknown[] = [];
    if (spec.importerId) {
      clauses.push("AND importer_id = ?");
      args.push(spec.importerId);
    }
    if (spec.supplierId) {
      clauses.push("AND supplier_id = ?");
      args.push(spec.supplierId);
    }
    if (spec.product) {
      clauses.push("AND product_description LIKE ?");
      args.push(`%${productKeyword(spec.product)}%`);
    }
    const month = monthClause(spec.months || []);
    if (month.sql) {
      clauses.push(month.sql);
      args.push(...month.args);
    }
    const limit = spec.limit ? `LIMIT ${spec.limit}` : "";
    const sql = `SELECT * FROM ${this.table} WHERE 1=1 ${clauses.join(" ")} ORDER BY shipment_date DESC ${limit}`;
    const result = await this.db.prepare(sql).bind(...args).all();
    const rows = (result?.results || []) as Array<Record<string, unknown>>;
    return rows.map(row => shipmentFromRow(row));
  }
}
