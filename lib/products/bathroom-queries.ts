/**
 * Bathroom product query dictionary for ImportYeti data collection.
 *
 * Each query entry specifies ImportYeti search terms to use for targeted
 * bathroom plumbing product discovery. Keywords match product descriptions;
 * excludeTerms filter out non-bathroom results.
 *
 * Sprint 13 — Targeted Bathroom Market Collection
 */

export interface BathroomQuery {
  /** Category identifier */
  category: string;
  /** Human-readable category name */
  categoryName: string;
  /** Default HS code for this category */
  hsCode: string;
  /** Queries to run on ImportYeti */
  queries: string[];
  /** Keywords that confirm a match to this category */
  matchKeywords: string[];
  /** Keywords that indicate a NON-match (should be excluded) */
  excludeKeywords: string[];
}

export const BATHROOM_QUERIES: BathroomQuery[] = [
  {
    category: "bathroom_faucets",
    categoryName: "Bathroom Faucets",
    hsCode: "8481.80",
    queries: [
      "bathroom faucet",
      "lavatory faucet",
      "basin faucet",
      "vanity faucet",
      "widespread faucet",
      "faucet mixer",
      "bathroom tap",
      "single lever basin",
      "wall mount faucet",
    ],
    matchKeywords: [
      "bathroom faucet",
      "lavatory faucet",
      "basin faucet",
      "vanity faucet",
      "widespread faucet",
      "faucet mixer",
      "bathroom mixer",
      "basin mixer",
      "bathroom tap",
      "single lever basin",
      "single handle lavatory",
      "two handle lavatory",
      "wall mount faucet",
      "deck mount faucet",
      "vessel faucet",
      "sink faucet",
    ],
    excludeKeywords: [
      "kitchen faucet",
      "kitchen mixer",
      "kitchen sink",
      "pull down",
      "pull out",
      "bar faucet",
      "laundry faucet",
      "garden tap",
      "outdoor faucet",
      "industrial valve",
      "ball valve",
      "gate valve",
      "butterfly valve",
    ],
  },
  {
    category: "shower_systems",
    categoryName: "Shower Systems",
    hsCode: "3922.10",
    queries: [
      "shower system",
      "rain shower",
      "shower column",
      "hand shower",
      "shower head",
      "thermostatic shower",
      "shower panel",
      "shower set",
      "shower mixer",
    ],
    matchKeywords: [
      "shower system",
      "shower set",
      "rain shower",
      "shower head",
      "hand shower",
      "shower column",
      "shower mixer",
      "shower valve",
      "thermostatic shower",
      "shower kit",
      "shower panel",
    ],
    excludeKeywords: [
      "sauna",
      "steam room",
      "steam shower",
      "shower door",
      "shower enclosure",
      "shower curtain",
      "shower tray",
      "shower base",
      "shower pan",
      "shower stall",
    ],
  },
];

/**
 * Maximum number of results to request per query.
 * ImportYeti Top 50 pages return ~15-30 importers per query term.
 */
export const IMPORTYETI_RESULTS_PER_QUERY = 50;

/**
 * Total queries across both categories.
 */
export const TOTAL_QUERY_COUNT = BATHROOM_QUERIES.reduce(
  (sum, q) => sum + q.queries.length,
  0,
);

/**
 * Estimated total unique importers discoverable.
 * ~15 unique importers per query × 18 queries ≈ 270 potential buyers.
 */
export const ESTIMATED_UNIQUE_IMPORTERS = TOTAL_QUERY_COUNT * 15;

/**
 * Resolve which bathroom category a search query belongs to.
 */
export function resolveQueryCategory(
  searchQuery: string,
): BathroomQuery | null {
  for (const q of BATHROOM_QUERIES) {
    if (q.queries.includes(searchQuery)) return q;
  }
  return null;
}

/**
 * Compute product match confidence for a buyer's product descriptions
 * against a bathroom query's match/exclude keywords.
 */
export function computeProductMatchConfidence(
  productDescription: string,
  query: BathroomQuery,
): number {
  const lower = productDescription.toLowerCase();

  const matchHits = query.matchKeywords.filter(k =>
    lower.includes(k.toLowerCase()),
  ).length;

  const excludeHits = query.excludeKeywords.filter(k =>
    lower.includes(k.toLowerCase()),
  ).length;

  let confidence = 0;

  if (matchHits >= 3) confidence = 95;
  else if (matchHits === 2) confidence = 80;
  else if (matchHits === 1) confidence = 60;
  else if (productDescription.length > 0) confidence = 30;
  else confidence = 15;

  confidence -= excludeHits * 20;
  if (confidence < 5) confidence = 5;
  if (confidence > 100) confidence = 100;

  return confidence;
}
