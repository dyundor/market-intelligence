-- Data preservation fix: restore richer values lost to NULL/degraded overwrites.
-- Root cause: capture upsert files assigned excluded.address/website directly (no COALESCE),
-- so later captures with degraded or NULL values overwrote enriched profile data.
-- Rule: external data sources must never delete existing richer data.
--   - NULL must not overwrite existing values.
--   - Missing website must not remove website. Missing address must not remove address.
-- Idempotent: each statement only fires while the lost value is still missing/degraded.

-- 1) importer:bath-authority
--    Enriched by data/importyeti-importer-profiles-2026-08-05.sql, later overwritten by the
--    domustar capture upsert: address degraded, website + profile stats lost.
UPDATE importyeti_web_entities SET
  address='75 Hawk Rd Pa18974, Warminster, Pa 18974, Us',
  website='https://www.dreamline.com',
  total_shipments=1675,
  latest_shipment_date='2026-07-28',
  avg_teu_per_shipment='11.49',
  avg_teu_per_month='236.54',
  estimated_shipping_spend_usd=5700000,
  shipping_spend_coverage_percent=29,
  contact_data_status='masked_on_free_web',
  captured_at='2026-08-05',
  raw_evidence='{"source_profile":"company/bath-authority","alternate_names":4,"alternate_addresses":32,"last_month_shipments":25,"supplier_rows_identified":5,"supplier_rows_missing_name":2}'
WHERE id='importer:bath-authority'
  AND (NOT address GLOB '*[0-9]*' OR website IS NULL OR total_shipments < 1675);

-- 2) importer:mjf-group
--    Website was explicitly deleted by data/remove-unverified-importer-websites-2026-08-05.sql.
--    Per the preservation rule, missing website must not remove website; restore it and mark
--    unverified instead of keeping the field deleted.
UPDATE importyeti_web_entities SET
  website='https://www.meijiefaucet.com',
  website_status='unverified',
  website_source_url=source_url,
  website_verified_at=NULL
WHERE id='importer:mjf-group' AND website IS NULL;

-- 3) Company names degraded by re-running capture upserts (web-capture rows carried shorter
--    names than the BOL-derived canonical names in importyeti-recent-50-shipments-2026-08-05.sql).
UPDATE importyeti_web_entities SET name='B&K Llc'
WHERE id='importer:b-k' AND name='B&K';
UPDATE importyeti_web_entities SET name='Mjf Group Inc'
WHERE id='importer:mjf-group' AND name='MJF Group';

-- 4) contact_data_status degraded from 'masked_on_free_web' to 'not_checked'
--    by re-running capture upserts that carried the default status.
UPDATE importyeti_web_entities SET contact_data_status='masked_on_free_web'
WHERE id IN ('importer:b-k','importer:mjf-group') AND contact_data_status='not_checked';
