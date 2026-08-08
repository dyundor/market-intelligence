-- Identity quality: alias backfill, entity-level confidence, fuzzy candidate flags.
-- Confidence scale:
--   100 = exact identity (source profile / relationship evidence)
--   90  = normalized match (BOL name normalization)
--   70  = fuzzy candidate (possible duplicate pair, or search-page-only evidence)
--   <70 = unresolved (name-only row)
-- No low-confidence merges are performed here; candidates are only flagged for review.
-- Safe to re-run: alias inserts are ON CONFLICT DO NOTHING; confidence updates are
-- evidence-driven and deterministic.

-- 1) Backfill official_name aliases for every entity that lacks one (confidence 100: exact).
INSERT OR IGNORE INTO company_identity_aliases
  (id, company_id, alias_type, alias_value, normalized_value, source_channel, source_url, confidence, first_seen_at, last_seen_at)
SELECT 'alias:name:' || id, id, 'official_name', name, lower(trim(name)),
       source_channel, source_url, 100, COALESCE(captured_at, first_seen_at, '2026-08-05'), COALESCE(captured_at, first_seen_at, '2026-08-05')
FROM importyeti_web_entities
WHERE NOT EXISTS (SELECT 1 FROM company_identity_aliases a WHERE a.company_id = importyeti_web_entities.id AND a.alias_type = 'official_name');

-- 2) Backfill source_key aliases for every entity that lacks one (confidence 100: exact).
--    First materialize source_entity_key (same formula as migration 0007) for entities
--    created by capture files, then register the alias.
UPDATE importyeti_web_entities SET
  source_entity_key = source_channel || ':' || entity_type || ':' ||
    CASE
      WHEN instr(source_url, '/company/') > 0 THEN substr(source_url, instr(source_url, '/company/') + 9)
      WHEN instr(source_url, '/supplier/') > 0 THEN substr(source_url, instr(source_url, '/supplier/') + 10)
      ELSE id
    END
WHERE source_entity_key IS NULL;

INSERT OR IGNORE INTO company_identity_aliases
  (id, company_id, alias_type, alias_value, normalized_value, source_channel, source_url, confidence, first_seen_at, last_seen_at)
SELECT 'alias:source:' || id, id, 'source_key', source_entity_key, lower(trim(source_entity_key)),
       source_channel, source_url, 100, COALESCE(captured_at, first_seen_at, '2026-08-05'), COALESCE(captured_at, first_seen_at, '2026-08-05')
FROM importyeti_web_entities
WHERE source_entity_key IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM company_identity_aliases a WHERE a.company_id = importyeti_web_entities.id AND a.alias_type = 'source_key');

-- 3) Flag possible duplicate pairs as fuzzy candidates (70). No automatic merge.
--    Pair evidence is documented per pair; identities were kept separate on purpose.
UPDATE importyeti_web_entities SET
  identity_confidence = 70,
  identity_status = 'fuzzy_candidate',
  identity_notes = '{"fuzzy_pair":["importer:vetta-kitchen-and-bath-manufacturin","importer:vetta-mexico-de"],"reason":"shared name token vetta; same product; different countries US/MX"}'
WHERE id IN ('importer:vetta-kitchen-and-bath-manufacturin','importer:vetta-mexico-de');

UPDATE importyeti_web_entities SET
  identity_confidence = 70,
  identity_status = 'fuzzy_candidate',
  identity_notes = '{"fuzzy_pair":["supplier:meijie-faucet","supplier:guangdong-meijie-faucet"],"reason":"shared tokens meijie faucet; Shenzhen vs Dongguan addresses"}'
WHERE id IN ('supplier:meijie-faucet','supplier:guangdong-meijie-faucet');

UPDATE importyeti_web_entities SET
  identity_confidence = 70,
  identity_status = 'fuzzy_candidate',
  identity_notes = '{"fuzzy_pair":["importer:bath-authority","importer:luxaris","importer:russian-sauna"],"reason":"same city Warminster PA, same supplier zhongshan-domustar-shower, same shower product"}'
WHERE id IN ('importer:bath-authority','importer:luxaris','importer:russian-sauna');

UPDATE importyeti_web_entities SET
  identity_confidence = 70,
  identity_status = 'fuzzy_candidate',
  identity_notes = '{"fuzzy_pair":["importer:ldr-global-industries","supplier:ldr-global-resources-vietnam"],"reason":"shared tokens ldr global; importer vs supplier; US vs VN"}'
WHERE id IN ('importer:ldr-global-industries','supplier:ldr-global-resources-vietnam');

UPDATE importyeti_web_entities SET
  identity_confidence = 70,
  identity_status = 'fuzzy_candidate',
  identity_notes = '{"fuzzy_pair":["supplier:zhongshan-kohler-shower","supplier:zhongshan-domustar-shower"],"reason":"same city Zhongshan, shared product word shower; weak candidate"}'
WHERE id IN ('supplier:zhongshan-kohler-shower','supplier:zhongshan-domustar-shower');

-- 4) Assign entity-level confidence + status for all remaining entities (idempotent).
--    Evidence tiers: source_profile / relationship_supplier = exact (100);
--    discoveredFromShipment / relationship_shipments / discovered_from = normalized (90);
--    result_page / search_result_page = fuzzy candidate (70); anything else = unresolved (40).
UPDATE importyeti_web_entities SET
  identity_confidence = CASE
    WHEN id LIKE 'seed-%' THEN 100
    WHEN raw_evidence LIKE '%source_profile%' OR raw_evidence LIKE '%relationship_supplier%' THEN 100
    WHEN raw_evidence LIKE '%discoveredFromShipment%' OR raw_evidence LIKE '%relationship_shipments%' OR raw_evidence LIKE '%discovered_from%' THEN 90
    WHEN raw_evidence LIKE '%result_page%' OR raw_evidence LIKE '%search_result_page%' THEN 70
    ELSE 40
  END,
  identity_status = CASE
    WHEN id LIKE 'seed-%' THEN 'source_verified'
    WHEN raw_evidence LIKE '%source_profile%' OR raw_evidence LIKE '%relationship_supplier%' OR raw_evidence LIKE '%discoveredFromShipment%' OR raw_evidence LIKE '%relationship_shipments%' OR raw_evidence LIKE '%discovered_from%' THEN 'source_verified'
    WHEN raw_evidence LIKE '%result_page%' OR raw_evidence LIKE '%search_result_page%' THEN 'fuzzy_candidate'
    ELSE 'unresolved'
  END
WHERE id NOT IN (
  'importer:vetta-kitchen-and-bath-manufacturin','importer:vetta-mexico-de',
  'supplier:meijie-faucet','supplier:guangdong-meijie-faucet',
  'importer:bath-authority','importer:luxaris','importer:russian-sauna',
  'importer:ldr-global-industries','supplier:ldr-global-resources-vietnam',
  'supplier:zhongshan-kohler-shower','supplier:zhongshan-domustar-shower'
);
