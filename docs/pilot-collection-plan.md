# Pilot Collection Plan

Prepared: 2026-08-08 | Sprint 14.1

## 1. Objective

Execute the first real ImportYeti paid collection to validate bathroom buyer data quality. Run 5 targeted queries, spend ≤20 credits, and confirm that the pipeline correctly processes, deduplicates, and scores incoming importers.

## 2. Credit Budget

| Item | Credits | Notes |
|------|---------|-------|
| Total budget | 100 | Project-wide fixed allocation |
| Reserve (untouchable) | 25 | Per ImportYeti policy in AGENTS.md |
| Available to spend | 75 | Total − reserve |
| **Pilot maximum** | **20** | Hard cap for this experiment |
| Expected pilot usage | 12–15 | Conservative 3 cr/query estimate |
| Remaining after pilot | 60–63 | Leaves 55–58 for future collections |

Credit estimation basis: ImportYeti Top 50 search page. Each page returns up to 50 importers (typically 15–30 for niche plumbing terms). Free queries already cached are not re-billed.

## 3. Target Queries

### Query 1: bathroom faucet

| Field | Detail |
|-------|--------|
| HS code | 8481.80 |
| Status | Already collected (free — cached) |
| Credits needed | 0 |
| Existing importers | 7 (all with shipment data) |
| Expected new | 0 — refresh cache if stale, otherwise skip |
| Product match | HIGH — term directly matches bathroom faucet imports |
| Overlap risk | None for this query alone |

### Query 2: lavatory faucet

| Field | Detail |
|-------|--------|
| HS code | 8481.80 |
| Status | New — never queried |
| Credits needed | 3 |
| Expected importers | 12–20 |
| Expected confirmed | 8–15 (60–75% relevant) |
| Product match | HIGH — "lavatory" is exclusively bathroom terminology |
| Exclusion risk | LOW — excludes kitchen/industrial by keyword filtering |
| Overlap risk | Medium — may share importers with "bathroom faucet" (same HS) |

### Query 3: basin faucet

| Field | Detail |
|-------|--------|
| HS code | 8481.80 |
| Status | New — never queried |
| Credits needed | 3 |
| Expected importers | 12–20 |
| Expected confirmed | 8–15 |
| Product match | HIGH — "basin faucet" targets bathroom vessel basins |
| Exclusion risk | LOW |
| Overlap risk | Medium — same HS as queries 1–2 |

### Query 4: shower system

| Field | Detail |
|-------|--------|
| HS code | 3922.10 |
| Status | New — never queried |
| Credits needed | 3 |
| Expected importers | 12–20 |
| Expected confirmed | 8–15 |
| Product match | HIGH — "shower system" is a complete bathroom product category |
| Exclusion risk | Medium — "shower" may match shower doors/enclosures; exclude keywords active |
| Overlap risk | Low — different HS code, different buyers than faucet category |

### Query 5: rain shower

| Field | Detail |
|-------|--------|
| HS code | 3922.10 |
| Status | New — never queried |
| Credits needed | 3 |
| Expected importers | 10–18 |
| Expected confirmed | 6–12 |
| Product match | HIGH — "rain shower" is a distinct subcategory |
| Exclusion risk | LOW — unlikely to match non-bathroom |
| Overlap risk | Low–Medium — may overlap with "shower system" |

### Summary

| Query | Credits | Est. Importers | Est. Confirmed |
|-------|---------|----------------|----------------|
| bathroom faucet | 0 | 7 (existing) | 7 |
| lavatory faucet | 3 | 12–20 | 8–15 |
| basin faucet | 3 | 12–20 | 8–15 |
| shower system | 3 | 12–20 | 8–15 |
| rain shower | 3 | 10–18 | 6–12 |
| **Total new** | **12** | **34–58** | **22–42** |

## 4. Overlap Analysis

Faucet queries (bathroom/lavatory/basin) share HS 8481.80. Shower queries (system/rain) share HS 3922.10. Cross-HS overlap is negligible.

| Overlap scenario | Est. unique after merge |
|------------------|------------------------|
| Faucet queries share 40% importers | 3 raw → ~22 unique |
| Shower queries share 30% importers | 2 raw → ~17 unique |
| Cross-category overlap | 0–2 importers |
| **Total estimated unique new** | **35–55** |

Identity system handles deduplication via `companyIdentityKey` name normalization.

## 5. Validation Goals

After collection, validate each of these systems:

### 5.1 Buyer Relevance

- [ ] ≥70% of new importers have product descriptions matching bathroom keywords
- [ ] ≤10% of new importers flagged with `product_mismatch` risk factor
- [ ] All importers classified as CONFIRMED or CANDIDATE_BATHROOM (no CANDIDATE_GENERIC from bathroom queries)

### 5.2 Product Matching Accuracy

- [ ] `productMatchConfidence` ≥50 for ≥70% of new importers
- [ ] Exclude keywords correctly filter kitchen/industrial products
- [ ] Non-bathroom companies (sauna, lighting, furniture) correctly get lower confidence

### 5.3 Company Identity Resolution

- [ ] Duplicate names across queries merged into single `companyIdentityKey`
- [ ] No importer appears twice in ranked output with different IDs
- [ ] `identity_confidence` scores remain consistent between old and new data
- [ ] Cross-query buyers correctly deduplicated (e.g., same company found in both "bathroom faucet" and "lavatory faucet")

### 5.4 Supplier Relationship Quality

- [ ] Each new importer has ≥1 supplier relationship if it has shipment data
- [ ] No importer with ≥50 BOLs has only 1 supplier (triggers `missing_suppliers` risk flag)
- [ ] New relationships reference real supplier entities in the database

### 5.5 Ranking Quality

- [ ] New importers integrate into existing ranking without errors
- [ ] At least 2 new importers rank in top 10
- [ ] Priority distribution shifts: fewer C-tier buyers, more A/B-tier
- [ ] `qualificationScore` computed for all new buyers
- [ ] `dataCoverage` factor correctly identifies bathroom-confirmed buyers

## 6. Post-Collection Report Template

Run `node scripts/calibrate.mjs` after collection to generate:

```
PILOT COLLECTION RESULTS — Sprint 14.1
═══════════════════════════════════════

Date: [date]
Credits spent: [actual]
Queries executed: [count]
Errors: [none / list]

NEW BUYERS FOUND
────────────────
Total new importers added:     [N]
Confirmed bathroom buyers:     [N]  (with shipment data)
False positives / excluded:    [N]  (non-bathroom, incorrectly matched)

BUYER CLASSIFICATION
────────────────────
New CONFIRMED:          [N]  (bathroom query + shipment data)
New CANDIDATE_BATHROOM: [N]  (bathroom query, no data yet)
New CANDIDATE_GENERIC:  [N]  (should be 0 for bathroom queries)

RANKING CHANGES
───────────────
Before: A=[n] B=[n] C=[n]
After:  A=[n] B=[n] C=[n]
New top 10 buyers: [list]

QUALIFICATION CHANGES
─────────────────────
Buyers promoted (C→B or B→A): [N]
Buyers demoted:                [N]
Avg qualificationScore change: [N] points

PRODUCT MATCH QUALITY
─────────────────────
Avg productMatchConfidence: [N]%
Buyers with confidence ≥50: [N]/[total]
Buyers with exclude keyword hit: [N]

OVERLAP ANALYSIS
────────────────
New unique importers:               [N]
Importers found in multiple queries: [N]
Deduplication rate:                 [N]%

BUDGET
──────
Credits spent this pilot: [N]
Remaining total:          [N]
Reserve still protected:  Yes
```

## 7. Execution Order & Checkpoints

```
Run queries sequentially, stop to validate after each:

Step 1: bathroom faucet (0 cr) — verify cache is fresh → skip if ≤7 days old
Step 2: lavatory faucet (3 cr) — run → count importers → check ≥8 confirmed
  STOP if: <5 confirmed buyers returned
Step 3: basin faucet (3 cr) — run → compute overlap with step 2 → check uniqueness
  STOP if: >70% overlap with step 2 (query too similar)
Step 4: shower system (3 cr) — run → check different buyer set from faucets
  STOP if: credits spent exceed 15
Step 5: rain shower (3 cr) — run → compute overlap with step 4
  STOP if: credits spent would exceed 20 total

After each step: run calibrate.mjs to verify score changes.
After all steps: generate full post-collection report.
```

## 8. Stop Conditions

Abort the pilot if any of these occur:

- Any single query costs >5 credits (budget estimate was wrong)
- Two consecutive queries return <5 confirmed bathroom buyers each
- Total credits spent reaches 20
- ImportYeti returns an error that persists after 1 retry
- New data corrupts or overwrites existing richer data (data preservation rule violated)

## 9. Pre-Flight Checklist

Before executing any paid query:

- [ ] `docs/pilot-collection-plan.md` reviewed and approved
- [ ] At least 75 credits available in budget
- [ ] Database backed up (`.wrangler/state/` directory intact)
- [ ] Identity resolution system confirmed working (`identity_confidence` populated)
- [ ] Cache layer confirmed working (to avoid re-billing cached queries)
- [ ] Query exclusion keywords configured in `lib/products/dictionary.ts`
- [ ] `node scripts/calibrate.mjs` runs without errors (baseline established)
