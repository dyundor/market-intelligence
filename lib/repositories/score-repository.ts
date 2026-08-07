import type { DbLike } from "../db/types.ts";
import type { ScoredResult } from "../opportunity/types.ts";

export type ScoreScope = "buyer" | "market" | "product";

const SCORE_TABLES: Record<ScoreScope, string> = {
  buyer: "buyer_scores",
  market: "market_scores",
  product: "product_scores",
};

export interface StoredScore {
  id: string;
  score: number;
  factors: Array<Record<string, unknown>>;
  version: string;
  computedAt: string;
}

export class ScoreRepository {
  private readonly db: DbLike;

  constructor(db: DbLike) {
    this.db = db;
  }

  async save(scope: ScoreScope, result: ScoredResult): Promise<void> {
    const table = SCORE_TABLES[scope];
    await this.db
      .prepare(
        `INSERT INTO ${table} (id, score, factors, version, computed_at) VALUES (?,?,?,?,?)
         ON CONFLICT(id) DO UPDATE SET score=excluded.score, factors=excluded.factors, version=excluded.version, computed_at=excluded.computed_at`,
      )
      .bind(result.entityId, result.score, JSON.stringify(result.factors), result.version, result.computedAt)
      .run();
  }

  async latest(scope: ScoreScope, id: string): Promise<StoredScore | null> {
    const table = SCORE_TABLES[scope];
    const result = await this.db
      .prepare(`SELECT id, score, factors, version, computed_at FROM ${table} WHERE id = ?`)
      .bind(id)
      .all();
    const row = (result.results || [])[0];
    if (!row) return null;
    return {
      id: String(row.id || ""),
      score: Number(row.score || 0),
      factors: JSON.parse(String(row.factors || "[]")) as Array<Record<string, unknown>>,
      version: String(row.version || ""),
      computedAt: String(row.computed_at || ""),
    };
  }
}
