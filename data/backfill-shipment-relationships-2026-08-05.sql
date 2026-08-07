-- Promote only observed shipment pairs into verified relationships. Existing richer historical relationships are preserved.
INSERT INTO importyeti_web_relationships (id,supplier_id,importer_id,shipment_count,period_start,period_end,hs_codes,product_descriptions,source_url,source_channel,discovery_direction,evidence_status,captured_at)
SELECT 'rel:shipment:'||replace(sh.supplier_id,':','-')||':'||replace(sh.importer_id,':','-'),sh.supplier_id,sh.importer_id,COUNT(*),MIN(sh.shipment_date),MAX(sh.shipment_date),
  GROUP_CONCAT(DISTINCT CASE WHEN lower(sh.product_description) LIKE '%faucet%' THEN '8481.80' WHEN lower(sh.product_description) LIKE '%shower%' OR lower(sh.product_description) LIKE '%bathtub%' THEN '3922.10' END),
  GROUP_CONCAT(DISTINCT sh.product_description),MIN(sh.source_url),'importyeti_free_web','shipment_evidence','verified',MAX(sh.captured_at)
FROM importyeti_web_shipments sh WHERE sh.importer_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM importyeti_web_relationships r WHERE r.supplier_id=sh.supplier_id AND r.importer_id=sh.importer_id)
GROUP BY sh.supplier_id,sh.importer_id;
