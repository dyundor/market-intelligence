import type { ScoreFactor, ScoredResult } from "./types.ts";

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function logScale(value: number, benchmark: number): number {
  if (value <= 0) return 0;
  if (benchmark <= 1) return clamp(value, 0, 100);
  return clamp(100 * Math.log(1 + value) / Math.log(1 + benchmark), 0, 100);
}

export function ratioScale(value: number, benchmark: number): number {
  if (benchmark <= 0) return 0;
  return clamp(100 * Math.min(value, benchmark) / benchmark, 0, 100);
}

export function growthScore(current: number, previous: number): number {
  if (previous <= 0) return 50;
  if (current <= 0) return 0;
  return clamp(100 * current / previous / 2, 0, 100);
}

export function recencyScore(date: string | null, now = new Date()): number {
  if (!date) return 0;
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return 0;
  const days = (now.getTime() - parsed.getTime()) / 86_400_000;
  if (days < 0) return 100;
  return clamp(100 * (1 - days / 180), 0, 100);
}

export function buildScore(
  entityId: string,
  parts: Array<Omit<ScoreFactor, "contribution">>,
  version: string,
  now = new Date(),
): ScoredResult {
  const factors: ScoreFactor[] = parts.map(part => ({
    ...part,
    value: Math.round(part.value),
    contribution: Math.round(part.value * part.weight / 100),
  }));
  const score = Math.round(parts.reduce((sum, part) => sum + part.value * part.weight, 0) / 100);
  return { entityId, score, factors, version, computedAt: now.toISOString() };
}
