import type { Shipment } from "../entities/shipment.ts";
import { buildScore, growthScore, logScale, ratioScale } from "./metrics.ts";
import { SCORE_VERSION, type ProductScoreInput, type ScoreOptions, type ScoredResult } from "./types.ts";

export function productScore(input: ProductScoreInput, options: ScoreOptions = {}): ScoredResult {
  const now = options.now || new Date();
  const buyers = Math.max(1, input.buyerCount);
  const growth = input.previousShipmentCount !== undefined ? growthScore(input.shipmentCount, input.previousShipmentCount) : 50;
  return buildScore(
    options.entityId || input.product || "product",
    [
      { id: "volume", label: "Shipment volume (log scale, 500-shipment benchmark)", value: logScale(input.shipmentCount, 500), weight: 30 },
      { id: "growth", label: "Shipment growth vs previous period (0% = neutral 50)", value: growth, weight: 25 },
      { id: "buyerCount", label: "Buyer count (log scale, 100-buyer benchmark)", value: logScale(input.buyerCount, 100), weight: 25 },
      { id: "competition", label: "Supplier competition (suppliers per buyer, benchmark 5)", value: ratioScale(input.supplierCount / buyers, 5), weight: 20 },
    ],
    SCORE_VERSION,
    now,
  );
}

export function productScoreFromShipments(product: string, shipments: Shipment[], previous: Shipment[] = [], options: ScoreOptions = {}): ScoredResult {
  const input = productInputFromShipments(product, shipments, previous);
  return productScore(input, { now: options.now, entityId: options.entityId || product });
}

export function productInputFromShipments(product: string, shipments: Shipment[], previous: Shipment[] = []): ProductScoreInput {
  const buyerSet = new Set<string>();
  const supplierSet = new Set<string>();
  for (const shipment of shipments) {
    if (shipment.importerId) buyerSet.add(shipment.importerId);
    if (shipment.supplierId) supplierSet.add(shipment.supplierId);
  }
  return {
    shipmentCount: shipments.length,
    previousShipmentCount: previous.length ? previous.length : undefined,
    buyerCount: buyerSet.size,
    supplierCount: supplierSet.size,
  };
}
