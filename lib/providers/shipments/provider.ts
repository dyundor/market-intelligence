import type { Provider } from "../types.ts";
import { shipmentDataCapability } from "../mock/capabilities.ts";
import type { QueryRequest } from "../../query/types.ts";
import { ShipmentRepository } from "../../repositories/shipment-repository.ts";
import type { DbLike } from "../../db/types.ts";

export interface ShipmentDataOptions {
  db: DbLike;
}

export class ShipmentRankingProvider implements Provider {
  readonly capability = shipmentDataCapability;
  private readonly repository: ShipmentRepository;

  constructor(options: ShipmentDataOptions) {
    this.repository = new ShipmentRepository(options.db);
  }

  async fetch(query: QueryRequest): Promise<unknown> {
    const months = (query.months || []).filter(value => /^20\d{2}-\d{2}$/.test(value));
    const shipments = await this.repository.findByProduct(query.subject, months);
    return { shipments };
  }
}
