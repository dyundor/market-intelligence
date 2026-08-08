-- Fix: shipments captured from supplier profile pages carried importer_name but no importer_id.
-- 1) Create entity records for importers that were only ever referenced by name.
-- 2) Backfill importer_id on those shipments by resolving importer_name against the entity table.
-- 3) Register identity aliases so future captures resolve to the same entity.
-- Safe to re-run: all statements are idempotent.

-- 1) Missing importer entities (discovered from shipment evidence on supplier pages).
INSERT INTO importyeti_web_entities
  (id, entity_type, name, country, country_code, contact_data_status, source_url, source_channel,
   source_entity_key, identity_status, first_seen_at, updated_at, record_version, source_attribution,
   search_query, captured_at, raw_evidence)
VALUES
  ('importer:legion-furniture', 'importer', 'Legion Furniture LLC', 'United States', 'US', 'not_checked',
   'https://www.importyeti.com/supplier/sagarit-bathroom-manufacturer', 'importyeti_free_web',
   'importyeti_free_web:importer:legion-furniture', 'source_verified', '2026-08-05', '2026-08-05', 1,
   'ImportYeti / U.S. Customs and Border Protection', 'shipment importer name', '2026-08-05',
   '{"discoveredFromShipment":true,"capturedOnSupplierPage":true}')
ON CONFLICT(id) DO NOTHING;

INSERT INTO importyeti_web_entities
  (id, entity_type, name, country, country_code, contact_data_status, source_url, source_channel,
   source_entity_key, identity_status, first_seen_at, updated_at, record_version, source_attribution,
   search_query, captured_at, raw_evidence)
VALUES
  ('importer:dc-import', 'importer', 'DC Import LLC', 'United States', 'US', 'not_checked',
   'https://www.importyeti.com/supplier/sagarit-bathroom-manufacturer', 'importyeti_free_web',
   'importyeti_free_web:importer:dc-import', 'source_verified', '2026-08-05', '2026-08-05', 1,
   'ImportYeti / U.S. Customs and Border Protection', 'shipment importer name', '2026-08-05',
   '{"discoveredFromShipment":true,"capturedOnSupplierPage":true}')
ON CONFLICT(id) DO NOTHING;

INSERT INTO importyeti_web_entities
  (id, entity_type, name, country, country_code, contact_data_status, source_url, source_channel,
   source_entity_key, identity_status, first_seen_at, updated_at, record_version, source_attribution,
   search_query, captured_at, raw_evidence)
VALUES
  ('importer:blossom-kitchen-and-bath-supply', 'importer', 'Blossom Kitchen And Bath Supply Corp', 'United States', 'US', 'not_checked',
   'https://www.importyeti.com/supplier/sagarit-bathroom-manufacturer', 'importyeti_free_web',
   'importyeti_free_web:importer:blossom-kitchen-and-bath-supply', 'source_verified', '2026-08-05', '2026-08-05', 1,
   'ImportYeti / U.S. Customs and Border Protection', 'shipment importer name', '2026-08-05',
   '{"discoveredFromShipment":true,"capturedOnSupplierPage":true}')
ON CONFLICT(id) DO NOTHING;

-- 2) Backfill importer_id: exact normalized name match, then "Door/Door" variant match.
UPDATE importyeti_web_shipments
SET importer_id = (
  SELECT e.id FROM importyeti_web_entities e
  WHERE e.entity_type = 'importer'
    AND replace(lower(trim(importyeti_web_shipments.importer_name)), '.', '')
      = replace(lower(trim(e.name)), '.', '')
  LIMIT 1
)
WHERE importer_id IS NULL AND importer_name IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM importyeti_web_entities e
    WHERE e.entity_type = 'importer'
      AND replace(lower(trim(importyeti_web_shipments.importer_name)), '.', '')
        = replace(lower(trim(e.name)), '.', '')
  );

UPDATE importyeti_web_shipments
SET importer_id = (
  SELECT e.id FROM importyeti_web_entities e
  WHERE e.entity_type = 'importer'
    AND replace(replace(lower(trim(importyeti_web_shipments.importer_name)), '.', ''), 'door ', 'doors ')
      = replace(replace(lower(trim(e.name)), '.', ''), 'door ', 'doors ')
  LIMIT 1
)
WHERE importer_id IS NULL AND importer_name IS NOT NULL;

-- 3) Identity aliases for the resolved names so future captures reuse these entities.
INSERT INTO company_identity_aliases
  (id, company_id, alias_type, alias_value, normalized_value, source_channel, source_url, confidence, first_seen_at, last_seen_at)
SELECT 'alias:name:' || importer_id || ':' || replace(lower(trim(importer_name)), ' ', '-'), importer_id, 'official_name',
       max(importer_name), lower(trim(importer_name)), 'importyeti_free_web', MIN(source_url), 100, MIN(captured_at), MAX(captured_at)
FROM importyeti_web_shipments
WHERE importer_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM company_identity_aliases a
    WHERE a.company_id = importyeti_web_shipments.importer_id
      AND a.alias_type = 'official_name'
      AND a.normalized_value = lower(trim(importyeti_web_shipments.importer_name))
  )
GROUP BY importer_id, lower(trim(importer_name))
ON CONFLICT(company_id, alias_type, normalized_value) DO NOTHING;
