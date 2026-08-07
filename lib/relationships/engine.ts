import type { Shipment } from "../entities/shipment.ts";
import type { BuyerSupplierRelationship, RelationshipMetrics } from "./types.ts";

export function buildBuyerSupplierRelationships(shipments: Shipment[]): BuyerSupplierRelationship[] {
  const groups = new Map<string, BuyerSupplierRelationship & { sources: Set<string> }>();
  for (const shipment of shipments) {
    if (!shipment.importerId || !shipment.supplierId) continue;
    const key = `${shipment.importerId}:${shipment.supplierId}:${shipment.productCategory}`;
    let relationship = groups.get(key);
    if (!relationship) {
      relationship = {
        buyerId: shipment.importerId,
        supplierId: shipment.supplierId,
        productCategory: shipment.productCategory,
        shipmentCount: 0,
        firstSeen: shipment.shipmentDate,
        lastSeen: shipment.shipmentDate,
        source: shipment.source || "unknown",
        sources: new Set(),
      };
      groups.set(key, relationship);
    }
    relationship.shipmentCount += 1;
    if (shipment.shipmentDate) {
      if (!relationship.firstSeen || shipment.shipmentDate < relationship.firstSeen) relationship.firstSeen = shipment.shipmentDate;
      if (!relationship.lastSeen || shipment.shipmentDate > relationship.lastSeen) relationship.lastSeen = shipment.shipmentDate;
    }
    relationship.sources.add(shipment.source || "unknown");
  }
  return [...groups.values()].map(({ sources, source, ...relationship }) => ({
    ...relationship,
    source: sources.size > 1 ? [...sources].sort().join(",") : source,
  }));
}

export function relationshipMetrics(relationship: BuyerSupplierRelationship): RelationshipMetrics {
  let spanMonths = 0;
  if (relationship.firstSeen && relationship.lastSeen) {
    const first = new Date(Date.UTC(Number(relationship.firstSeen.slice(0, 4)), Number(relationship.firstSeen.slice(5, 7)) - 1, 1));
    const last = new Date(Date.UTC(Number(relationship.lastSeen.slice(0, 4)), Number(relationship.lastSeen.slice(5, 7)) - 1, 1));
    spanMonths = (last.getUTCFullYear() - first.getUTCFullYear()) * 12 + (last.getUTCMonth() - first.getUTCMonth()) + 1;
  }
  return { shipmentCount: relationship.shipmentCount, spanMonths: Math.max(0, spanMonths) };
}
