import type { DbLike } from "../db/types.ts";

const ENTITY_COLUMNS = "id, entity_type, name, address, country, country_code, city_name, website, latest_shipment_date, total_shipments";

export class CompanyRepository {
  private readonly db: DbLike;

  constructor(db: DbLike) {
    this.db = db;
  }

  async findById(id: string): Promise<Record<string, unknown> | null> {
    const result = await this.db
      .prepare(`SELECT ${ENTITY_COLUMNS} FROM importyeti_web_entities WHERE id = ?`)
      .bind(id)
      .all();
    return (result.results || [])[0] || null;
  }

  async findByIds(ids: string[]): Promise<Array<Record<string, unknown>>> {
    if (!ids.length) return [];
    const placeholders = ids.map(() => "?").join(",");
    const result = await this.db
      .prepare(`SELECT ${ENTITY_COLUMNS} FROM importyeti_web_entities WHERE id IN (${placeholders})`)
      .bind(...ids)
      .all();
    return result.results || [];
  }

  async findByName(name: string, limit = 10): Promise<Array<Record<string, unknown>>> {
    const like = `%${name.trim()}%`;
    const result = await this.db
      .prepare(
        `SELECT ${ENTITY_COLUMNS} FROM importyeti_web_entities WHERE name LIKE ? OR address LIKE ? ORDER BY COALESCE(total_shipments, 0) DESC LIMIT ?`,
      )
      .bind(like, like, limit)
      .all();
    return result.results || [];
  }

  async findDetailById(id: string): Promise<Record<string, unknown> | null> {
    const result = await this.db
      .prepare(
        `SELECT id, entity_type, name, address, country, country_code, admin1_code, admin1_name, city_name, location_names, location_precision, website, website_status, website_source_url, website_verified_at, chinese_name, marketplace_urls, total_shipments, latest_shipment_date, avg_teu_per_shipment, avg_teu_per_month, estimated_shipping_spend_usd, shipping_spend_coverage_percent, contact_data_status, source_url, source_attribution, captured_at FROM importyeti_web_entities WHERE id = ?`,
      )
      .bind(id)
      .all();
    return (result.results || [])[0] || null;
  }

  async listRelationships(id: string, entityType: "importer" | "supplier"): Promise<Array<Record<string, unknown>>> {
    const join =
      entityType === "importer"
        ? "FROM importyeti_web_relationships r JOIN importyeti_web_entities s ON s.id = r.supplier_id LEFT JOIN importyeti_web_shipments sh ON sh.supplier_id = s.id AND sh.importer_id = r.importer_id WHERE r.importer_id = ? GROUP BY r.id"
        : "FROM importyeti_web_relationships r JOIN importyeti_web_entities i ON i.id = r.importer_id LEFT JOIN importyeti_web_shipments sh ON sh.supplier_id = ? AND sh.importer_id = i.id WHERE r.supplier_id = ? GROUP BY r.id";
    const result = await this.db
      .prepare(
        `SELECT r.id, r.shipment_count, r.period_start, r.period_end, r.hs_codes, r.product_descriptions, r.discovery_direction, r.evidence_status,
          ${entityType === "importer" ? "s" : "i"}.id company_id, ${entityType === "importer" ? "s" : "i"}.name company_name, ${entityType === "importer" ? "s" : "i"}.address company_address, ${entityType === "importer" ? "s" : "i"}.country company_country, ${entityType === "importer" ? "s" : "i"}.country_code company_country_code, ${entityType === "importer" ? "s" : "i"}.admin1_name company_admin1_name, ${entityType === "importer" ? "s" : "i"}.city_name company_city_name, ${entityType === "importer" ? "s" : "i"}.location_names company_location_names, ${entityType === "importer" ? "s" : "i"}.location_precision company_location_precision, ${entityType === "importer" ? "s" : "i"}.website, ${entityType === "importer" ? "s" : "i"}.total_shipments, ${entityType === "importer" ? "s" : "i"}.latest_shipment_date, ${entityType === "importer" ? "s" : "i"}.source_url,
          COUNT(DISTINCT sh.id) captured_bols, COALESCE(SUM(sh.weight_kg), 0) captured_weight_kg, COALESCE(SUM(sh.container_count), 0) captured_containers, COALESCE(SUM(CAST(sh.estimated_freight_usd AS REAL)), 0) captured_freight_usd
        ${join} ORDER BY r.shipment_count DESC`,
      )
      .bind(...(entityType === "importer" ? [id] : [id, id]))
      .all();
    return result.results || [];
  }

  async monthlyBreakdown(id: string, entityType: "importer" | "supplier"): Promise<Array<Record<string, unknown>>> {
    const importer = entityType === "importer";
    const result = await this.db
      .prepare(
        `SELECT substr(sh.shipment_date, 1, 7) month,
          sh.${importer ? "supplier_id" : "importer_id"} counterparty_id, ${importer ? "s" : "i"}.name counterparty_name, ${importer ? "s" : "i"}.country counterparty_country,
          sh.${importer ? "supplier_id" : "importer_id"} supplier_id, ${importer ? "s" : "i"}.name supplier_name, ${importer ? "s" : "i"}.country supplier_country,
          COUNT(DISTINCT sh.id) shipments, COALESCE(SUM(sh.weight_kg), 0) weight_kg, COALESCE(SUM(sh.container_count), 0) containers,
          COALESCE(SUM(CAST(sh.estimated_freight_usd AS REAL)), 0) estimated_freight_usd, COUNT(sh.estimated_freight_usd) freight_covered_shipments,
          GROUP_CONCAT(DISTINCT sh.product_description) products
        FROM importyeti_web_shipments sh JOIN importyeti_web_entities ${importer ? "s ON s.id = sh.supplier_id" : "i ON i.id = sh.importer_id"}
        WHERE sh.${importer ? "importer_id" : "supplier_id"} = ? GROUP BY month, sh.${importer ? "supplier_id" : "importer_id"} ORDER BY month DESC, shipments DESC`,
      )
      .bind(id)
      .all();
    return result.results || [];
  }
}
