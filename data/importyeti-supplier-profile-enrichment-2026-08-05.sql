-- Supplier profile enrichment. Website values are copied only when ImportYeti
-- visibly exposes the external link on the supplier profile.
UPDATE importyeti_web_entities SET
  address='22 Chien Kuo Rd Taichung Export Processing Zone Tantzu Taichung Taiwan',
  website='https://www.globeunion.com',total_shipments=14454,latest_shipment_date='2026-07-28',
  avg_teu_per_shipment='4.8',avg_teu_per_month='660.53',estimated_shipping_spend_usd=31700000,
  shipping_spend_coverage_percent=53,contact_data_status='not_checked',captured_at='2026-08-05',
  raw_evidence='{"source_profile":"supplier/globe-union-industrial","alternate_names":15,"alternate_addresses":39,"website_status":"verified_visible_link"}'
WHERE id='supplier:globe-union-industrial';

UPDATE importyeti_web_entities SET
  address='Town West Rd 75 Shangtian Development Area Fenghua City Ningbo Zhejiang China',
  website='https://www.waltmal.com',total_shipments=1820,latest_shipment_date='2026-07-28',
  avg_teu_per_shipment='2.54',avg_teu_per_month='44.22',estimated_shipping_spend_usd=4600000,
  shipping_spend_coverage_percent=59,contact_data_status='not_checked',captured_at='2026-08-05',
  raw_evidence='{"source_profile":"supplier/ningbo-waltmal-sanitary-wares","alternate_names":24,"alternate_addresses":43,"website_status":"verified_visible_link"}'
WHERE id='supplier:ningbo-waltmal-sanitary-wares';

UPDATE importyeti_web_entities SET
  address='Lizhidun Village Futian Town Boluo County Huizhou City Guangdong China',
  total_shipments=220,latest_shipment_date='2022-04-22',estimated_shipping_spend_usd=42520,
  shipping_spend_coverage_percent=5,contact_data_status='not_checked',captured_at='2026-08-05',
  raw_evidence='{"source_profile":"supplier/fufeng-hardware-manufactory","alternate_names":1,"alternate_addresses":7,"website_status":"not_exposed_on_importyeti_profile"}'
WHERE id='supplier:fufeng-hardware-manufactory';

UPDATE importyeti_web_entities SET
  address='No 2 Renchang Rd Beijiao Town Shunde District Foshan China',
  total_shipments=68,latest_shipment_date='2026-07-09',avg_teu_per_shipment='2.49',avg_teu_per_month='2.29',
  estimated_shipping_spend_usd=58077,shipping_spend_coverage_percent=33,contact_data_status='not_checked',captured_at='2026-08-05',
  raw_evidence='{"source_profile":"supplier/foshan-shunde-kangkang-plumbing","alternate_names":3,"alternate_addresses":4,"website_status":"not_exposed_on_importyeti_profile"}'
WHERE id='supplier:foshan-shunde-kangkang-plumbing';
