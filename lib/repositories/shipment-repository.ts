import type { DbLike } from "../db/types.ts";
import type { Shipment } from "../entities/shipment.ts";
import { shipmentFromRow, enrichShipmentRow } from "../entities/shipment.ts";
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

export interface CompanyShipmentPage {
  companyId: string;
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  month: string;
  months: Array<Record<string, unknown>>;
  shipments: Array<Record<string, unknown>>;
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

  async listCompanyShipments(
    companyId: string,
    options: { month?: string; page?: number; pageSize?: number } = {},
  ): Promise<CompanyShipmentPage | null> {
    const page = Math.max(1, options.page || 1);
    const pageSize = Math.min(50, Math.max(10, options.pageSize || 20));
    const month = options.month || "";
    const company = await this.db
      .prepare("SELECT id, entity_type FROM importyeti_web_entities WHERE id = ?")
      .bind(companyId)
      .all();
    const entity = (company.results || [])[0] as { entity_type?: string } | undefined;
    if (!entity) return null;
    const field = entity.entity_type === "supplier" ? "sh.supplier_id" : "sh.importer_id";
    const monthClauseSql = month ? " AND substr(sh.shipment_date,1,7)=?" : "";
    const binds = month ? [companyId, month] : [companyId];
    const count = await this.db
      .prepare(`SELECT COUNT(*) total FROM importyeti_web_shipments sh WHERE ${field}=?${monthClauseSql}`)
      .bind(...binds)
      .all();
    const total = Number((count.results[0] as { total?: number | string } | undefined)?.total || 0);
    const pageResult = await this.db
      .prepare(
        `SELECT sh.id,sh.shipment_date,sh.date_basis,sh.actual_arrival_date,sh.house_bol,sh.master_bol,sh.weight_kg,sh.quantity,sh.quantity_unit,sh.container_count,sh.product_description,sh.estimated_freight_usd,sh.source_url,sh.captured_at,
        supplier.id supplier_id,supplier.name supplier_name,supplier.country supplier_country,importer.id importer_id,importer.name importer_name,importer.country importer_country
        FROM importyeti_web_shipments sh
        LEFT JOIN importyeti_web_entities supplier ON supplier.id=sh.supplier_id
        LEFT JOIN importyeti_web_entities importer ON importer.id=sh.importer_id
        WHERE ${field}=?${monthClauseSql} ORDER BY sh.shipment_date DESC,sh.id DESC LIMIT ? OFFSET ?`,
      )
      .bind(...binds, pageSize, (page - 1) * pageSize)
      .all();
    const months = await this.db
      .prepare(`SELECT substr(sh.shipment_date,1,7) month,COUNT(*) shipments FROM importyeti_web_shipments sh WHERE ${field}=? GROUP BY 1 ORDER BY 1 DESC`)
      .bind(companyId)
      .all();
    return {
      companyId,
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
      month,
      months: months.results,
      shipments: (pageResult.results || []).map(row => enrichShipmentRow(row)),
    };
  }

  async findById(id: string): Promise<Record<string, unknown> | null> {
    const result = await this.db
      .prepare(
        `SELECT sh.*,supplier.name supplier_name,supplier.address supplier_address,supplier.country supplier_country,supplier.website supplier_website,
        importer.name importer_entity_name,importer.address importer_address,importer.country importer_country,importer.website importer_website
        FROM importyeti_web_shipments sh LEFT JOIN importyeti_web_entities supplier ON supplier.id=sh.supplier_id LEFT JOIN importyeti_web_entities importer ON importer.id=sh.importer_id WHERE sh.id=?`,
      )
      .bind(id)
      .all();
    const row = (result.results || [])[0];
    return row ? enrichShipmentRow(row) : null;
  }
}
