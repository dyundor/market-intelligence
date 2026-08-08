-- Fix: merge duplicate company identities discovered during Sprint 7.8 data quality validation.
-- Evidence per pair (preserved in raw capture files and entity raw_evidence):
--   supplier:zs-domustar-shower          -> supplier:zhongshan-domustar-shower   (raw_evidence.possible_alias_of)
--   supplier:guangdong-meijie-faucet-li  -> supplier:guangdong-meijie-faucet     (raw_evidence.possible_alias, same Changlong village address)
--   supplier:lsh-faucet                  -> supplier:jiangsu-lsh-faucet          (identical address "W Ziwei Ave Xuyi EDZ Jiangsu 211700 China")
--   importer:t-a-luxaris-trade           -> importer:luxaris                     (same city Warminster PA, same supplier Zhongshan Domustar, same product)
--   importer:posey-import                -> importer:posey-supply                (same supplier Guangdong Meijie Faucet, same faucet product, capture-name variant)
-- Safe to re-run: every statement is guarded by the existence of the source row.

-- 1) Re-point shipments to canonical entity ids.
UPDATE importyeti_web_shipments SET supplier_id = 'supplier:zhongshan-domustar-shower'
WHERE supplier_id = 'supplier:zs-domustar-shower';
UPDATE importyeti_web_shipments SET supplier_id = 'supplier:guangdong-meijie-faucet'
WHERE supplier_id = 'supplier:guangdong-meijie-faucet-li';
UPDATE importyeti_web_shipments SET supplier_id = 'supplier:jiangsu-lsh-faucet'
WHERE supplier_id = 'supplier:lsh-faucet';
UPDATE importyeti_web_shipments SET importer_id = 'importer:luxaris'
WHERE importer_id = 'importer:t-a-luxaris-trade';
UPDATE importyeti_web_shipments SET importer_id = 'importer:posey-supply'
WHERE importer_id = 'importer:posey-import';

-- 2) Merge relationship counts into canonical rows, then drop duplicate relationship rows.
UPDATE importyeti_web_relationships
SET shipment_count = shipment_count + (SELECT shipment_count FROM importyeti_web_relationships WHERE id = 'zs-domustar-shower:bath-authority')
WHERE id = 'zhongshan-domustar-shower:bath-authority'
  AND EXISTS (SELECT 1 FROM importyeti_web_relationships WHERE id = 'zs-domustar-shower:bath-authority');
DELETE FROM importyeti_web_relationships WHERE id = 'zs-domustar-shower:bath-authority';

UPDATE importyeti_web_relationships
SET shipment_count = shipment_count + (SELECT shipment_count FROM importyeti_web_relationships WHERE id = 'guangdong-meijie-faucet-li:mjf-group')
WHERE id = 'guangdong-meijie-faucet:mjf-group'
  AND EXISTS (SELECT 1 FROM importyeti_web_relationships WHERE id = 'guangdong-meijie-faucet-li:mjf-group');
DELETE FROM importyeti_web_relationships WHERE id = 'guangdong-meijie-faucet-li:mjf-group';

UPDATE importyeti_web_relationships
SET shipment_count = shipment_count + (SELECT shipment_count FROM importyeti_web_relationships WHERE id = 'zhongshan-domustar-shower:t-a-luxaris-trade')
WHERE id = 'zhongshan-domustar-shower:luxaris'
  AND EXISTS (SELECT 1 FROM importyeti_web_relationships WHERE id = 'zhongshan-domustar-shower:t-a-luxaris-trade');
DELETE FROM importyeti_web_relationships WHERE id = 'zhongshan-domustar-shower:t-a-luxaris-trade';

UPDATE importyeti_web_relationships
SET shipment_count = shipment_count + (SELECT shipment_count FROM importyeti_web_relationships WHERE id = 'rel:shipment:supplier-guangdong-meijie-faucet:importer-posey-import')
WHERE id = 'guangdong-meijie-faucet:posey-supply'
  AND EXISTS (SELECT 1 FROM importyeti_web_relationships WHERE id = 'rel:shipment:supplier-guangdong-meijie-faucet:importer-posey-import');
DELETE FROM importyeti_web_relationships WHERE id = 'rel:shipment:supplier-guangdong-meijie-faucet:importer-posey-import';

-- 3) Register the merged names as identity aliases on the canonical entities.
INSERT INTO company_identity_aliases
  (id, company_id, alias_type, alias_value, normalized_value, source_channel, source_url, confidence, first_seen_at, last_seen_at)
SELECT 'alias:name:supplier:zhongshan-domustar-shower:zs-domustar-shower', 'supplier:zhongshan-domustar-shower', 'official_name',
       name, lower(trim(name)), source_channel, source_url, 95, captured_at, captured_at
FROM importyeti_web_entities WHERE id = 'supplier:zs-domustar-shower'
ON CONFLICT(company_id, alias_type, normalized_value) DO NOTHING;

INSERT INTO company_identity_aliases
  (id, company_id, alias_type, alias_value, normalized_value, source_channel, source_url, confidence, first_seen_at, last_seen_at)
SELECT 'alias:name:supplier:guangdong-meijie-faucet:guangdong-meijie-faucet-li', 'supplier:guangdong-meijie-faucet', 'official_name',
       name, lower(trim(name)), source_channel, source_url, 95, captured_at, captured_at
FROM importyeti_web_entities WHERE id = 'supplier:guangdong-meijie-faucet-li'
ON CONFLICT(company_id, alias_type, normalized_value) DO NOTHING;

INSERT INTO company_identity_aliases
  (id, company_id, alias_type, alias_value, normalized_value, source_channel, source_url, confidence, first_seen_at, last_seen_at)
SELECT 'alias:name:supplier:jiangsu-lsh-faucet:lsh-faucet', 'supplier:jiangsu-lsh-faucet', 'official_name',
       name, lower(trim(name)), source_channel, source_url, 95, captured_at, captured_at
FROM importyeti_web_entities WHERE id = 'supplier:lsh-faucet'
ON CONFLICT(company_id, alias_type, normalized_value) DO NOTHING;

INSERT INTO company_identity_aliases
  (id, company_id, alias_type, alias_value, normalized_value, source_channel, source_url, confidence, first_seen_at, last_seen_at)
SELECT 'alias:name:importer:luxaris:t-a-luxaris-trade', 'importer:luxaris', 'official_name',
       name, lower(trim(name)), source_channel, source_url, 90, captured_at, captured_at
FROM importyeti_web_entities WHERE id = 'importer:t-a-luxaris-trade'
ON CONFLICT(company_id, alias_type, normalized_value) DO NOTHING;

INSERT INTO company_identity_aliases
  (id, company_id, alias_type, alias_value, normalized_value, source_channel, source_url, confidence, first_seen_at, last_seen_at)
SELECT 'alias:name:importer:posey-supply:posey-import', 'importer:posey-supply', 'official_name',
       name, lower(trim(name)), source_channel, source_url, 90, captured_at, captured_at
FROM importyeti_web_entities WHERE id = 'importer:posey-import'
ON CONFLICT(company_id, alias_type, normalized_value) DO NOTHING;

-- 4) Drop the duplicate entity rows (raw definitions remain in the capture SQL files).
DELETE FROM importyeti_web_entities WHERE id IN (
  'supplier:zs-domustar-shower',
  'supplier:guangdong-meijie-faucet-li',
  'supplier:lsh-faucet',
  'importer:t-a-luxaris-trade',
  'importer:posey-import'
);

-- 5) Drop identity aliases that referenced the merged-away entities.
DELETE FROM company_identity_aliases WHERE company_id IN (
  'supplier:zs-domustar-shower',
  'supplier:guangdong-meijie-faucet-li',
  'supplier:lsh-faucet',
  'importer:t-a-luxaris-trade',
  'importer:posey-import'
);
