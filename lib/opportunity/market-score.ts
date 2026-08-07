import type { Shipment } from "../entities/shipment.ts";
import { buildScore, growthScore, logScale, ratioScale } from "./metrics.ts";
import { SCORE_VERSION, type MarketScoreInput, type ScoreOptions, type ScoredResult } from "./types.ts";

export function marketScore(input: MarketScoreInput, options: ScoreOptions = {}): ScoredResult {
  const now = options.now || new Date();
  const buyers = Math.max(1, input.buyerCount);
  const growth = input.previousVolumeKg !== undefined ? growthScore(input.importVolumeKg, input.previousVolumeKg) : 50;
  return buildScore(
    options.entityId || input.market || "US",
    [
      { id: "volume", label: "Import volume (log scale, 1,000,000 kg benchmark)", value: logScale(input.importVolumeKg, 1_000_000), weight: 30 },
      { id: "growth", label: "Import growth vs previous period (0% = neutral 50)", value: growth, weight: 30 },
      { id: "buyerCount", label: "Buyer count (log scale, 100-buyer benchmark)", value: logScale(input.buyerCount, 100), weight: 20 },
      { id: "competition", label: "Supplier competition (suppliers per buyer, benchmark 5)", value: ratioScale(input.supplierCount / buyers, 5), weight: 20 },
    ],
    SCORE_VERSION,
    now,
  );
}

export function marketScoreFromShipments(market: string, shipments: Shipment[], previous: Shipment[] = [], options: ScoreOptions = {}): ScoredResult {
  const input = marketInputFromShipments(market, shipments, previous);
  return marketScore(input, { now: options.now, entityId: options.entityId || market });
}

export function marketInputFromShipments(market: string, shipments: Shipment[], previous: Shipment[] = []): MarketScoreInput {
  const buyerSet = new Set<string>();
  const supplierSet = new Set<string>();
  let volumeKg = 0;
  for (const shipment of shipments) {
    if (shipment.importerId) buyerSet.add(shipment.importerId);
    if (shipment.supplierId) supplierSet.add(shipment.supplierId);
    volumeKg += shipment.weight || 0;
  }
  let previousVolumeKg: number | undefined;
  if (previous.length) {
    previousVolumeKg = 0;
    for (const shipment of previous) previousVolumeKg += shipment.weight || 0;
  }
  return {
    importVolumeKg: volumeKg,
    previousVolumeKg,
    buyerCount: buyerSet.size,
    supplierCount: supplierSet.size,
  };
}
