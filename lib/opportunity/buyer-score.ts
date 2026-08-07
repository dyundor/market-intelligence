import type { Shipment } from "../entities/shipment.ts";
import { buildScore, logScale, ratioScale, recencyScore } from "./metrics.ts";
import { SCORE_VERSION, type BuyerScoreInput, type ScoreOptions, type ScoredResult } from "./types.ts";

export function buyerScore(input: BuyerScoreInput, options: ScoreOptions = {}): ScoredResult {
  const now = options.now || new Date();
  const frequency = input.activeMonths > 0 ? input.shipmentCount / input.activeMonths : 0;
  return buildScore(
    options.entityId || "buyer",
    [
      { id: "activity", label: "Shipment activity (log scale, 50-shipment benchmark)", value: logScale(input.shipmentCount, 50), weight: 35 },
      { id: "frequency", label: "Import frequency (shipments per active month, benchmark 10)", value: ratioScale(frequency, 10), weight: 30 },
      { id: "supplierDiversity", label: "Supplier diversity (benchmark 12 suppliers)", value: ratioScale(input.supplierCount, 12), weight: 20 },
      { id: "recency", label: "Recency of last shipment (180-day decay)", value: recencyScore(input.lastShipmentDate, now), weight: 15 },
    ],
    SCORE_VERSION,
    now,
  );
}

export function buyerScoreFromShipments(shipments: Shipment[], options: ScoreOptions = {}): ScoredResult {
  const valid = shipments.filter(shipment => shipment.importerId);
  const first = valid[0];
  const monthSet = new Set<string>();
  const supplierSet = new Set<string>();
  let lastShipmentDate: string | null = null;
  for (const shipment of valid) {
    if (shipment.month) monthSet.add(shipment.month);
    if (shipment.supplierId) supplierSet.add(shipment.supplierId);
    if (shipment.shipmentDate && (!lastShipmentDate || shipment.shipmentDate > lastShipmentDate)) lastShipmentDate = shipment.shipmentDate;
  }
  return buyerScore(
    {
      shipmentCount: valid.length,
      activeMonths: monthSet.size,
      supplierCount: supplierSet.size,
      lastShipmentDate,
    },
    { now: options.now, entityId: options.entityId || first?.importerId || "unknown" },
  );
}
