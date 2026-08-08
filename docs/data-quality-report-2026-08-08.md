# Data Quality Report — Company Identity

Date: 2026-08-08
Scope: `importyeti_web_entities`, `company_identity_aliases`, `importyeti_web_shipments` (identity fields only)
Applies to: live D1 database, 90 entities (50 importers, 40 suppliers), 187 shipments, 79 relationships

## 1. Duplicate companies

- **Exact duplicates: 0.** Five confirmed duplicates were merged previously
  (`data/fix-identity-merge-2026-08-08.sql`): zs-domustar-shower, guangdong-meijie-faucet-li,
  lsh-faucet, t-a-luxaris-trade, posey-import.
- **Fuzzy candidate pairs: 5 (11 entities), flagged at confidence 70, NOT merged.**

  | Pair | Evidence | Status |
  |---|---|---|
  | importer:vetta-kitchen-and-bath-manufacturin ↔ importer:vetta-mexico-de | shared token "vetta", same product, US vs MX | review candidate |
  | supplier:meijie-faucet ↔ supplier:guangdong-meijie-faucet | shared tokens "meijie faucet", Shenzhen vs Dongguan | review candidate |
  | importer:bath-authority ↔ importer:luxaris ↔ importer:russian-sauna | same city Warminster PA, same supplier zhongshan-domustar-shower | review candidate |
  | importer:ldr-global-industries ↔ supplier:ldr-global-resources-vietnam | shared tokens "ldr global", importer vs supplier | review candidate |
  | supplier:zhongshan-kohler-shower ↔ supplier:zhongshan-domustar-shower | same city Zhongshan, shared product word "shower" (weak) | review candidate |

  Pair evidence is stored in `importyeti_web_entities.identity_notes` (JSON). No
  low-confidence merge was performed; these require human/verified review.

## 2. Unresolved entities

- **Confidence < 70: 0.** Every entity carries at least name-level evidence.
- **Search-page-only (no relationship/shipment anchor), confidence 70: 8 suppliers** —
  chung-cheng-faucet, delta-faucet, dibiao-bathroom, dura-shower-enclosures,
  jiangsu-lsh-faucet, kent-faucet, penta-faucet, sagarit-bathroom-manufacturer.
  Discovered from ImportYeti supplier search result pages only; identities are
  candidates until profile or relationship evidence is captured.
- **Shipment importer matching: 0 NULL importer_id, 0 importer_name that does not
  match an alias of its linked entity.** All 187 shipments resolve.

## 3. Missing profile fields

| entity_type | n | no address | no country | no website | no evidence |
|---|---|---|---|---|---|
| importer | 50 | 36 | 0 | 46 | 1 (seed, intentional) |
| supplier | 40 | 0 | 0 | 34 | 2 (seed, intentional) |

Website absence is ImportYeti free-web masking (contact data is not exposed), not
data loss; `contact_data_status='masked_on_free_web'` records this.

## 4. Identity confidence distribution

Scale: 100 = exact, 90 = normalized match, 70 = fuzzy candidate, <70 = unresolved.

| confidence | status | count | evidence basis |
|---|---|---|---|
| 100 | source_verified | 12 | source profile / cross-verified relationship / seed |
| 90 | source_verified | 59 | name normalization (BOL shipments, relationship shipment lists) |
| 70 | fuzzy_candidate | 19 | duplicate-pair candidates (11) or search-page-only (8) |
| <70 | unresolved | 0 | — |

## 5. Alias system

- 183 aliases total: 93 `official_name`, 90 `source_key`; 0 orphan aliases.
- 100% entity coverage (all 90 entities have both alias types; 40/40 suppliers).
- Confidence per alias: 100 exact (source-derived), 95/90 evidence-based merged names.
- `source_entity_key` backfilled for 50 capture-created entities that lacked it
  (formula from migration 0007); unique per entity.

## 6. Supplier identity

- 40 suppliers each have a canonical entity id, official_name + source_key aliases,
  and an identity confidence score.
- Relationships and shipments reference only canonical supplier ids: 0 references to
  missing entities across `importyeti_web_relationships` and `importyeti_web_shipments`.

## 7. Data preservation (re-verified)

- No remaining NULL/degraded overwrites: all capture upserts are COALESCE/guarded
  (street-address, keep-higher shipment counts, keep-longer names, non-default
  contact status).
- No `SET website=NULL` / `SET address=NULL` statements remain in `data/` or `scripts/`.
- Rule documented in `AGENTS.md` (Data preservation rule) and enforced by
  `data/fix-data-preservation-2026-08-08.sql`.

## 8. Changes shipped in this sprint

- `drizzle/0010_company_identity_confidence.sql` — `identity_confidence`,
  `identity_notes` columns.
- `data/fix-identity-confidence-2026-08-08.sql` — alias backfill, source-key
  backfill, confidence scoring, fuzzy-pair flags (idempotent).
- This report.

## Remaining limitations

- Fuzzy pairs (section 1) need verified review before any merge decision.
- 8 suppliers have no captured profile/relationship yet (search-page-only).
- BOL-derived entity names retain source artifacts (e.g. "Vetta Kitchen And Bath
  Manufacturin", "Home Depot Usainc") — normalized matching handles them, but
  display names are not canonicalized.
