import type { BuyerRanking } from "./types.ts";
import type { DbLike } from "../db/types.ts";

export async function persistMonthlyRankings(deps: { db: DbLike; ranking: BuyerRanking }): Promise<number> {
  const { db, ranking } = deps;
  const months = ranking.requestedMonths.filter(month => /^20\d{2}-\d{2}$/.test(month));
  let written = 0;
  for (const month of months) {
    const year = Number(month.slice(0, 4));
    const monthNumber = Number(month.slice(5, 7));
    for (const entry of ranking.ranked) {
      const buyerId = String(entry.id || entry.name || "");
      if (!buyerId) continue;
      const id = [ranking.market, ranking.productCategory, month, ranking.metric, buyerId].join(":");
      await db
        .prepare(
          "INSERT INTO buyer_monthly_rankings (id, market, product_category, year, month, buyer_id, rank, metric, metric_value, source, created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET rank=excluded.rank, metric_value=excluded.metric_value, source=excluded.source, created_at=excluded.created_at",
        )
        .bind(
          id,
          ranking.market,
          ranking.productCategory,
          year,
          monthNumber,
          buyerId,
          entry.rank,
          ranking.metric,
          entry.metric_value,
          ranking.dataset,
          new Date().toISOString(),
        )
        .run();
      written += 1;
    }
  }
  return written;
}
