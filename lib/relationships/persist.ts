import type { DbLike } from "../db/types.ts";
import { RelationshipRepository } from "../repositories/relationship-repository.ts";
import type { BuyerSupplierRelationship } from "./types.ts";

export async function persistBuyerSupplierRelationships(deps: {
  db: DbLike;
  relationships: BuyerSupplierRelationship[];
}): Promise<number> {
  return new RelationshipRepository(deps.db).save(deps.relationships);
}
