import type { NormalizedData, QueryRequest } from "../query/types.ts";
import type { Shipment } from "../entities/shipment.ts";
import { shipmentFromRow } from "../entities/shipment.ts";
import { rankShipments } from "../ranking/engine.ts";
import { resolveProduct } from "../products/resolver.ts";

export function normalizeShipments(raw: unknown): Shipment[] {
  const items = Array.isArray(raw)
    ? raw
    : raw && typeof raw === "object" && Array.isArray((raw as { shipments?: unknown }).shipments)
      ? (raw as { shipments: unknown[] }).shipments
      : [];
  return items.map(item => (isShipmentEntity(item) ? (item as Shipment) : shipmentFromRow(item as Record<string, unknown>)));
}

function isShipmentEntity(item: unknown): boolean {
  return !!item && typeof item === "object" && "source" in item && "sourceShipmentId" in item;
}

export function normalizeShipmentRanking(raw: unknown, query: QueryRequest): NormalizedData {
  const shipments = normalizeShipments(raw);
  const months = query.months?.length ? query.months : [query.period];
  const category = resolveProduct(query.subject);
  const ranking = rankShipments(shipments, {
    market: query.market,
    flow: query.flow || "import",
    product: query.subject,
    dataset: "shipment_data",
    hsCode: category?.defaultHsCode || "",
    requestedMonths: months,
    metric: query.ranking?.metric || "shipment_count",
    limit: query.ranking?.limit || 20,
  });
  return { kind: "ranking", ranking };
}
