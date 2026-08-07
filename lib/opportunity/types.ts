export const SCORE_VERSION = "opportunity-v1";

export interface ScoreFactor {
  id: string;
  label: string;
  value: number;
  weight: number;
  contribution: number;
}

export interface ScoredResult {
  entityId: string;
  score: number;
  factors: ScoreFactor[];
  version: string;
  computedAt: string;
}

export interface BuyerScoreInput {
  shipmentCount: number;
  activeMonths: number;
  supplierCount: number;
  lastShipmentDate: string | null;
}

export interface MarketScoreInput {
  market?: string;
  importVolumeKg: number;
  previousVolumeKg?: number;
  buyerCount: number;
  supplierCount: number;
}

export interface ProductScoreInput {
  product?: string;
  shipmentCount: number;
  previousShipmentCount?: number;
  buyerCount: number;
  supplierCount: number;
}

export interface ScoreOptions {
  now?: Date;
  entityId?: string;
}
