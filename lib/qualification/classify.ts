/**
 * Buyer Classification — Sprint 14.12
 *
 * Three separate concepts:
 *   A. ProductMatch (HIGH/MEDIUM/LOW) — product relevance to target category
 *   B. BuyerType (Bathroom Specialist / Mixed / General Plumbing / Unknown)
 *   C. Priority (A/B/C) — development priority for sales outreach
 *
 * These are computed independently and shown together in reports.
 */

import type { ProductMatch, BuyerType } from "./types.ts";

// ─────── Keyword dictionaries ───────

const BATHROOM_KEYWORDS = [
  "bathroom", "lavatory", "basin", "vanity", "shower", "bath",
  "faucet", "tap", "mixer", "vessel", "widespread", "wall mount",
  "single lever", "single handle", "two handle", "deck mount",
  "bathroom mixer", "basin mixer", "shower head", "hand shower",
  "rain shower", "shower column", "shower panel", "thermostatic",
  "sanitary", "toilet", "bidet", "urinal", "water closet",
];

const KITCHEN_KEYWORDS = [
  "kitchen faucet", "kitchen mixer", "kitchen sink", "kitchen tap",
  "pull down", "pull out", "bar faucet", "bar sink", "pot filler",
];

const INDUSTRIAL_KEYWORDS = [
  "industrial valve", "ball valve", "gate valve", "butterfly valve",
  "check valve", "solenoid valve", "control valve", "pressure valve",
];

const SAUNA_KEYWORDS = ["sauna", "steam room"];

const OTHER_PLUMBING = [
  "pipe", "fitting", "connector", "adapter", "coupling", "flange",
  "elbow", "tee", "nipple", "plug", "cap", "hose", "tube",
];

// ─────── A. ProductMatch ───────

export function classifyProductMatch(
  productDescriptions: string[],
  apiRelevanceScore?: number,
): { match: ProductMatch; confidence: number; reason: string } {
  const text = productDescriptions.join(" ").toLowerCase();

  if (!text) {
    return { match: "LOW", confidence: 15, reason: "无产品描述数据" };
  }

  const bathHits = BATHROOM_KEYWORDS.filter(k => text.includes(k)).length;
  const kitchenHits = KITCHEN_KEYWORDS.filter(k => text.includes(k)).length;
  const industrialHits = INDUSTRIAL_KEYWORDS.filter(k => text.includes(k)).length;
  const saunaHits = SAUNA_KEYWORDS.filter(k => text.includes(k)).length;

  // Start from API relevance if available
  let confidence = apiRelevanceScore || 0;
  if (!confidence) {
    // Compute from keyword density
    confidence = Math.min(100, bathHits * 15 + 10);
    confidence = Math.max(5, confidence - kitchenHits * 15 - industrialHits * 20 - saunaHits * 20);
  }

  let match: ProductMatch;
  let reason = "";

  if (bathHits >= 3 && kitchenHits === 0 && industrialHits === 0) {
    match = "HIGH";
    reason = `高匹配: ${bathHits} 个浴室关键词匹配，无厨房/工业关键词`;
  } else if (bathHits >= 2 && kitchenHits <= 1 && industrialHits === 0) {
    match = "HIGH";
    reason = `匹配: ${bathHits} 浴室关键词${kitchenHits ? `，${kitchenHits} 个厨房关键词` : ""}`;
  } else if (bathHits >= 1) {
    match = "MEDIUM";
    reason = `中等匹配: ${bathHits} 浴室关键词${kitchenHits ? `，${kitchenHits} 厨房` : ""}${industrialHits ? `，${industrialHits} 工业` : ""}`;
  } else if (kitchenHits > 0) {
    match = "LOW";
    reason = `低匹配: 主要为厨房产品 (${kitchenHits} 关键词)`;
  } else if (industrialHits > 0) {
    match = "LOW";
    reason = `低匹配: 主要为工业阀门 (${industrialHits} 关键词)`;
  } else if (saunaHits > 0) {
    match = "LOW";
    reason = `低匹配: 桑拿设备 (${saunaHits} 关键词)`;
  } else {
    match = "LOW";
    reason = "低匹配: 无明确浴室关键词";
  }

  return { match, confidence, reason };
}

// ─────── B. BuyerType ───────

export function classifyBuyerType(
  productDescriptions: string[],
  companyName: string,
): { type: BuyerType; reason: string } {
  const text = [...productDescriptions, companyName].join(" ").toLowerCase();

  const bathHits = BATHROOM_KEYWORDS.filter(k => text.includes(k)).length;
  const kitchenHits = KITCHEN_KEYWORDS.filter(k => text.includes(k)).length;
  const industrialHits = INDUSTRIAL_KEYWORDS.filter(k => text.includes(k)).length;
  const saunaHits = SAUNA_KEYWORDS.filter(k => text.includes(k)).length;
  const plumbingHits = OTHER_PLUMBING.filter(k => text.includes(k)).length;

  // Bathroom specialist: only bathroom keywords, no kitchen/industrial
  if (bathHits >= 2 && kitchenHits === 0 && industrialHits === 0 && saunaHits === 0) {
    return { type: "Bathroom Specialist", reason: "仅包含浴室产品关键词" };
  }

  // Mixed bathroom/kitchen
  if (bathHits >= 1 && kitchenHits >= 1) {
    return { type: "Mixed Bathroom/Kitchen", reason: `同时包含浴室(${bathHits})和厨房(${kitchenHits})关键词` };
  }

  // General plumbing
  if (bathHits >= 1 || plumbingHits >= 1) {
    return { type: "General Plumbing", reason: `卫浴/管道产品 (浴室:${bathHits}, 管道:${plumbingHits})` };
  }

  // Sauna or other
  if (saunaHits > 0) {
    return { type: "Unknown", reason: "桑拿/蒸汽设备" };
  }

  // Industrial
  if (industrialHits > 0) {
    return { type: "Unknown", reason: `工业阀门 (${industrialHits} 关键词)` };
  }

  return { type: "Unknown", reason: "无法确定买方类型" };
}

// ─────── C. Priority (unchanged — score-based) ───────

// Priority thresholds remain: A ≥55, B ≥25, C <25
// This is computed by qualificationScore in score.ts

// ─────── Combined classification ───────

export interface BuyerClassification {
  productMatch: ProductMatch;
  productMatchConfidence: number;
  productMatchReason: string;
  buyerType: BuyerType;
  buyerTypeReason: string;
}

export function classifyBuyer(
  productDescriptions: string[],
  companyName: string,
  apiRelevanceScore?: number,
): BuyerClassification {
  const product = classifyProductMatch(productDescriptions, apiRelevanceScore);
  const buyer = classifyBuyerType(productDescriptions, companyName);

  return {
    productMatch: product.match,
    productMatchConfidence: product.confidence,
    productMatchReason: product.reason,
    buyerType: buyer.type,
    buyerTypeReason: buyer.reason,
  };
}
