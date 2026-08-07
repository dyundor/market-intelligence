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
}
