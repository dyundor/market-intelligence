# Pilot Collection Plan — Sprint 14.1

Prepared: 2026-08-08

## Overview

This plan covers the first real ImportYeti paid API collection for Yundor bathroom market intelligence. The goal is to grow confirmed bathroom buyer coverage from 14 to an estimated 50-80 buyers using a phased approach with 5 priority queries.

**Budget context**: 100 total credits, 25 reserved, 75 available. None spent yet.

## Current Database State

| Metric | Value |
|--------|-------|
| Total importers | 50 |
| With shipment data | 14 (28%) |
| Without shipment data | 36 (72%) — generic queries, no BOLs |
| Total shipments stored | 187 |
| Total supplier relationships | 79 |
| Unique company names | 50 |

### Already Collected Query Performance

| Query | Importers | With Data | Efficiency |
|-------|-----------|-----------|------------|
| bathroom faucet | 7 | 7 | 100% |
| shower faucet | 6 | 6 | 100% |
| 龙头及阀类 | 1 | 1 | 100% |
| recent shipment importer | 33 | 0 | 0% |
| shipment importer name | 3 | 0 | 0% |

Key finding: product-specific queries deliver 100% relevant, shipment-bearing importers. Generic queries deliver 0% usable data.

---

## Priority 1 Queries

### Query 1: bathroom faucet

| Field | Value |
|-------|-------|
| **Status** | Already collected — no credits needed |
| **Current importers** | 7 |
| **Current confirmed buyers** | 7 (100%) |
| **Credit cost** | 0 (cached) |
| **Expected new importers** | 0 (use existing, refresh cache if stale) |
| **Product relevance** | HIGH — all 7 have bathroom faucet product descriptions |
| **Overlap with other queries** | Likely shares importers with basin/lavatory faucet |

### Query 2: lavatory faucet

| Field | Value |
|-------|-------|
| **Status** | Not yet collected |
| **Estimated credit cost** | 3 credits |
| **Expected importer count** | 15–25 |
| **Expected confirmed buyers** | 12–18 |
| **Product relevance** | HIGH — "lavatory" is bathroom-specific terminology |
| **Exclusion risk** | LOW — unlikely to match kitchen faucet or industrial valves |
| **Overlap with existing** | Medium — may overlap with "bathroom faucet" importers (same HS 8481.80) |
| **Estimated net new buyers** | 8–15 (after deduplication) |

### Query 3: basin faucet

| Field | Value |
|-------|-------|
| **Status** | Not yet collected |
| **Estimated credit cost** | 3 credits |
| **Expected importer count** | 15–25 |
| **Expected confirmed buyers** | 12–18 |
| **Product relevance** | HIGH — "basin faucet" is very specific to bathroom/vessel basins |
| **Exclusion risk** | LOW — "basin" in plumbing context is bathroom, not kitchen |
| **Overlap with existing** | Medium — may overlap with bathroom/lavatory faucet results |
| **Estimated net new buyers** | 8–15 (after deduplication) |

### Query 4: shower system

| Field | Value |
|-------|-------|
| **Status** | Not yet collected |
| **Estimated credit cost** | 3 credits |
| **Expected importer count** | 15–25 |
| **Expected confirmed buyers** | 10–18 |
| **Product relevance** | HIGH — "shower system" is specific to bathroom shower equipment |
| **Exclusion risk** | LOW-MEDIUM — may return shower door/enclosure companies (exclude on product description) |
| **Overlap with existing** | Low — different category (shower vs faucet), different HS code (3922.10 vs 8481.80) |
| **Estimated net new buyers** | 10–18 (low overlap with faucet queries) |

### Query 5: rain shower

| Field | Value |
|-------|-------|
| **Status** | Not yet collected |
| **Estimated credit cost** | 3 credits |
| **Expected importer count** | 12–20 |
| **Expected confirmed buyers** | 8–15 |
| **Product relevance** | HIGH — "rain shower" is a distinct bathroom product subcategory |
| **Exclusion risk** | LOW — rain shower is not used for non-bathroom products |
| **Overlap with existing** | Low-Medium — may overlap with "shower system" importers |
| **Estimated net new buyers** | 6–12 (after deduplication) |

---

## Budget Analysis

### Per-Query Credit Estimate

| Query | Credits | Est. Importers | Est. Confirmed | Est. New |
|-------|---------|----------------|----------------|----------|
| bathroom faucet | 0 | 7 (existing) | 7 | 0 |
| lavatory faucet | 3 | 15–25 | 12–18 | 8–15 |
| basin faucet | 3 | 15–25 | 12–18 | 8–15 |
| shower system | 3 | 15–25 | 10–18 | 10–18 |
| rain shower | 3 | 12–20 | 8–15 | 6–12 |
| **Total new** | **12** | **42–70** | **30–51** | **24–45** |

### Budget Position

| Metric | Value |
|--------|-------|
| Total budget | 100 credits |
| Reserve (untouchable) | 25 credits |
| Available to spend | 75 credits |
| This pilot cost | 12 credits |
| % of total budget | 12% |
| % of available | 16% |
| Remaining after pilot | 63 credits (88% of available) |
| Reserve still protected | Yes (25 → 25) |

### Credit Efficiency

| Metric | Value |
|--------|-------|
| Cost per confirmed buyer | ~0.3 credits ($12 / 40 buyers) |
| Cost per net new buyer | ~0.4 credits ($12 / 30 net new) |
| Waste (non-bathroom results) | ~12 credits distributed across 5 queries → expected <2 credits wasted on irrelevant results |

---

## Expected Database Growth

| Metric | Before | After (est.) | Growth |
|--------|--------|--------------|--------|
| Total importers | 50 | 74–120 | +48–140% |
| Importers with shipment data | 14 | 44–65 | +214–364% |
| Total shipments | 187 | ~500–1,200 | +167–542% |
| Supplier relationships | 79 | ~150–300 | +90–280% |
| Unique companies (deduplicated) | 50 | 70–95 | +40–90% |

---

## Overlap Mitigation

Bathroom faucet/lavatory faucet/basin faucet queries share the same HS code (8481.80). ImportYeti imports the same importer under multiple search queries if they appear in multiple result pages. The existing identity resolution system will merge duplicates by name normalization.

Expected deduplication:
- Faucet group (3 queries): ~30-50 unique importers (from 45-75 raw results)
- Shower group (2 queries): ~20-35 unique importers (from 27-45 raw results)
- Cross-group overlap: minimal (different HS codes)
- **Total unique estimate**: 50–70 new unique importers

---

## Success Criteria

### Minimum (pilot succeeds)

- [ ] 4 new queries executed without errors or credit overruns
- [ ] At least 20 new confirmed bathroom buyers added (with shipment data)
- [ ] 0 credit spent on queries that return zero relevant results
- [ ] Budget reserve (25 credits) untouched
- [ ] No existing buyer data overwritten or degraded

### Target (pilot is effective)

- [ ] 30+ new confirmed bathroom buyers added
- [ ] At least 80% of returned importers have product descriptions matching bathroom keywords
- [ ] At least 3 new importers with 100+ BOLs added
- [ ] At least 1 new buyer qualifies as Priority A
- [ ] Overlap rate between queries ≤40% (indicating good query diversity)

### Stretch (pilot was excellent value)

- [ ] 45+ new confirmed bathroom buyers added
- [ ] At least 5 new importers with 100+ BOLs
- [ ] Overlap rate ≤25%
- [ ] Identity system correctly merges all duplicates
- [ ] All 5 queries achieve 90%+ bathroom relevance

---

## Execution Order

```
1. lavatory faucet  (3 cr)  →  collect, validate yield
2. basin faucet     (3 cr)  →  collect, check overlap with #1
3. shower system    (3 cr)  →  collect, different category = low overlap
4. rain shower      (3 cr)  →  collect, check overlap with #3
5. bathroom faucet  (0 cr)  →  refresh cache if stale, no credits

Stop after each query to validate:
  - Actual credit cost vs estimate
  - Number of importers returned
  - Relevance rate (bathroom vs non-bathroom)
  - Overlap with previous queries

If any query returns <5 relevant importers, skip remaining queries
in that category and re-evaluate the strategy.
```

## Go / No-Go Criteria

Before starting each query, verify:

- [ ] At least 63 credits remain in budget (75 - 12 = 63 minimum)
- [ ] Previous query's results stored and validated
- [ ] No "reapproval_required" or "budget_blocked" state from prior query
- [ ] Identity system ready to deduplicate incoming importers

Stop collection entirely if:
- Any query costs >5 credits (over budget estimate)
- Two consecutive queries return <5 confirmed bathroom buyers each
- Budget drops below 30 credits (reserve + buffer)

---

## Post-Collection Steps

After all 5 queries complete:

1. Run deduplication: `companyIdentityKey` normalizes and merges duplicate importer names
2. Run qualification: score all new buyers, assign A/B/C priority
3. Run calibration report: validate new scores against expectations
4. Update coverage report: confirm classification of new importers
5. Document actual vs estimate variance for future collections
