-- Development-only seed data for local D1 (binding: DB -> site-creator-d1).
-- Safe to re-run: every insert is idempotent (ON CONFLICT DO NOTHING).
-- No paid APIs involved.

INSERT OR IGNORE INTO importyeti_web_entities
  (id, entity_type, name, address, country, country_code, admin1_code, admin1_name, city_name,
   location_names, location_precision, website, website_status, total_shipments, latest_shipment_date,
   avg_teu_per_shipment, avg_teu_per_month, estimated_shipping_spend_usd, shipping_spend_coverage_percent,
   contact_data_status, source_url, source_channel, identity_status, source_attribution, search_query, captured_at)
VALUES
  ('seed-us-importer-1', 'importer', 'AquaPro Trading Co.',
   '1200 Harbor Blvd, Suite 300, Los Angeles, CA 90210', 'United States', 'US', 'CA', 'California', 'Los Angeles',
   'Los Angeles, California, United States', 'city', 'https://aquaprotrading.example.com', 'verified', 36, '2026-07-15',
   '1.2', '2.4', 240000, 60, 'available', 'https://www.importyeti.com/company/aquapro-trading',
   'importyeti_free_web', 'source_verified', 'Seed data for local development', '龙头及阀类', '2026-07-15T08:00:00.000Z'),
  ('seed-cn-supplier-1', 'supplier', 'Guangzhou Faucet Manufacturing Co., Ltd.',
   'No. 88 Industrial Ave, Panyu District, Guangzhou, Guangdong', 'China', 'CN', '44', 'Guangdong', 'Guangzhou',
   'Guangzhou, Guangdong, China', 'city', 'https://gzfaucet.example.com', 'verified', 54, '2026-07-10',
   '1.1', '2.6', 180000, 55, 'available', 'https://www.importyeti.com/company/guangzhou-faucet',
   'importyeti_free_web', 'source_verified', 'Seed data for local development', '龙头及阀类', '2026-07-10T08:00:00.000Z'),
  ('seed-cn-supplier-2', 'supplier', 'Foshan Shower Hardware Co., Ltd.',
   'No. 21 Shuiyuan Road, Chancheng District, Foshan, Guangdong', 'China', 'CN', '44', 'Guangdong', 'Foshan',
   'Foshan, Guangdong, China', 'city', 'https://foshan-shower.example.com', 'verified', 31, '2026-07-08',
   '0.9', '1.8', 96000, 50, 'available', 'https://www.importyeti.com/company/foshan-shower-hardware',
   'importyeti_free_web', 'source_verified', 'Seed data for local development', '塑料浴缸及淋浴盆', '2026-07-08T08:00:00.000Z');

INSERT OR IGNORE INTO importyeti_web_relationships
  (id, supplier_id, importer_id, shipment_count, period_start, period_end, hs_codes, product_descriptions,
   source_url, source_channel, discovery_direction, evidence_status, captured_at)
VALUES
  ('seed-rel-faucet-1', 'seed-cn-supplier-1', 'seed-us-importer-1', 36, '2025-01-01', '2026-07-31',
   '8481.80, 8481.90', 'Brass faucets and valves 龙头及阀类; Faucet parts',
   'https://www.importyeti.com/company/aquapro-trading', 'importyeti_free_web', 'supplier_profile', 'verified', '2026-07-10T08:00:00.000Z'),
  ('seed-rel-shower-1', 'seed-cn-supplier-2', 'seed-us-importer-1', 18, '2025-06-01', '2026-07-31',
   '3922.10', 'Plastic shower heads 塑料浴缸及淋浴盆',
   'https://www.importyeti.com/company/aquapro-trading', 'importyeti_free_web', 'supplier_profile', 'verified', '2026-07-08T08:00:00.000Z');

INSERT OR IGNORE INTO importyeti_web_shipments
  (id, supplier_id, importer_id, importer_name, shipment_date, date_basis, house_bol, master_bol,
   weight_kg, quantity, quantity_unit, container_count, product_description, estimated_freight_usd,
   source_url, source_channel, captured_at)
VALUES
  -- Faucet shipments from supplier-1 (2026-07)
  ('seed-ship-f-001', 'seed-cn-supplier-1', 'seed-us-importer-1', 'AquaPro Trading Co.', '2026-07-14', 'import_declaration_date', 'SEEDBOL0001', 'SEEDMASTER0001', 18920, 980, 'CTN', 2, 'Brass faucets 龙头及阀类', '6200', 'https://www.importyeti.com/shipment/seed-ship-f-001', 'importyeti_free_web', '2026-07-15T08:00:00.000Z'),
  ('seed-ship-f-002', 'seed-cn-supplier-1', 'seed-us-importer-1', 'AquaPro Trading Co.', '2026-07-12', 'import_declaration_date', 'SEEDBOL0002', 'SEEDMASTER0002', 12450, 640, 'CTN', 1, 'Mixer faucets 龙头及阀类', '4100', 'https://www.importyeti.com/shipment/seed-ship-f-002', 'importyeti_free_web', '2026-07-13T08:00:00.000Z'),
  ('seed-ship-f-003', 'seed-cn-supplier-1', 'seed-us-importer-1', 'AquaPro Trading Co.', '2026-07-08', 'import_declaration_date', 'SEEDBOL0003', 'SEEDMASTER0003', 15100, 720, 'CTN', 1, 'Kitchen faucets 龙头及阀类', '4800', 'https://www.importyeti.com/shipment/seed-ship-f-003', 'importyeti_free_web', '2026-07-09T08:00:00.000Z'),
  -- Faucet shipments (2026-06)
  ('seed-ship-f-004', 'seed-cn-supplier-1', 'seed-us-importer-1', 'AquaPro Trading Co.', '2026-06-18', 'import_declaration_date', 'SEEDBOL0004', 'SEEDMASTER0004', 21400, 1100, 'CTN', 2, 'Brass faucets 龙头及阀类', '7100', 'https://www.importyeti.com/shipment/seed-ship-f-004', 'importyeti_free_web', '2026-06-19T08:00:00.000Z'),
  ('seed-ship-f-005', 'seed-cn-supplier-1', 'seed-us-importer-1', 'AquaPro Trading Co.', '2026-06-11', 'import_declaration_date', 'SEEDBOL0005', 'SEEDMASTER0005', 9800, 500, 'CTN', 1, 'Valves 龙头及阀类', '3300', 'https://www.importyeti.com/shipment/seed-ship-f-005', 'importyeti_free_web', '2026-06-12T08:00:00.000Z'),
  ('seed-ship-f-006', 'seed-cn-supplier-1', 'seed-us-importer-1', 'AquaPro Trading Co.', '2026-06-05', 'import_declaration_date', 'SEEDBOL0006', 'SEEDMASTER0006', 13800, 690, 'CTN', 1, 'Basin faucets 龙头及阀类', '4400', 'https://www.importyeti.com/shipment/seed-ship-f-006', 'importyeti_free_web', '2026-06-06T08:00:00.000Z'),
  -- Faucet shipments (2026-05)
  ('seed-ship-f-007', 'seed-cn-supplier-1', 'seed-us-importer-1', 'AquaPro Trading Co.', '2026-05-21', 'import_declaration_date', 'SEEDBOL0007', 'SEEDMASTER0007', 16700, 850, 'CTN', 2, 'Kitchen faucets 龙头及阀类', '5600', 'https://www.importyeti.com/shipment/seed-ship-f-007', 'importyeti_free_web', '2026-05-22T08:00:00.000Z'),
  ('seed-ship-f-008', 'seed-cn-supplier-1', 'seed-us-importer-1', 'AquaPro Trading Co.', '2026-05-13', 'import_declaration_date', 'SEEDBOL0008', 'SEEDMASTER0008', 11020, 560, 'CTN', 1, 'Brass faucets 龙头及阀类', '3700', 'https://www.importyeti.com/shipment/seed-ship-f-008', 'importyeti_free_web', '2026-05-14T08:00:00.000Z'),
  -- Faucet shipments (2026-04)
  ('seed-ship-f-009', 'seed-cn-supplier-1', 'seed-us-importer-1', 'AquaPro Trading Co.', '2026-04-16', 'import_declaration_date', 'SEEDBOL0009', 'SEEDMASTER0009', 19200, 990, 'CTN', 2, 'Mixer faucets 龙头及阀类', '6400', 'https://www.importyeti.com/shipment/seed-ship-f-009', 'importyeti_free_web', '2026-04-17T08:00:00.000Z'),
  ('seed-ship-f-010', 'seed-cn-supplier-1', 'seed-us-importer-1', 'AquaPro Trading Co.', '2026-04-09', 'import_declaration_date', 'SEEDBOL0010', 'SEEDMASTER0010', 8400, 430, 'CTN', 1, 'Valves 龙头及阀类', '2900', 'https://www.importyeti.com/shipment/seed-ship-f-010', 'importyeti_free_web', '2026-04-10T08:00:00.000Z'),
  -- Faucet shipments (2026-03)
  ('seed-ship-f-011', 'seed-cn-supplier-1', 'seed-us-importer-1', 'AquaPro Trading Co.', '2026-03-19', 'import_declaration_date', 'SEEDBOL0011', 'SEEDMASTER0011', 17500, 880, 'CTN', 2, 'Brass faucets 龙头及阀类', '5800', 'https://www.importyeti.com/shipment/seed-ship-f-011', 'importyeti_free_web', '2026-03-20T08:00:00.000Z'),
  ('seed-ship-f-012', 'seed-cn-supplier-1', 'seed-us-importer-1', 'AquaPro Trading Co.', '2026-03-06', 'import_declaration_date', 'SEEDBOL0012', 'SEEDMASTER0012', 12100, 610, 'CTN', 1, 'Basin faucets 龙头及阀类', '4000', 'https://www.importyeti.com/shipment/seed-ship-f-012', 'importyeti_free_web', '2026-03-07T08:00:00.000Z'),
  -- Faucet shipments (2026-02)
  ('seed-ship-f-013', 'seed-cn-supplier-1', 'seed-us-importer-1', 'AquaPro Trading Co.', '2026-02-17', 'import_declaration_date', 'SEEDBOL0013', 'SEEDMASTER0013', 15300, 780, 'CTN', 2, 'Kitchen faucets 龙头及阀类', '5100', 'https://www.importyeti.com/shipment/seed-ship-f-013', 'importyeti_free_web', '2026-02-18T08:00:00.000Z'),
  ('seed-ship-f-014', 'seed-cn-supplier-1', 'seed-us-importer-1', 'AquaPro Trading Co.', '2026-02-04', 'import_declaration_date', 'SEEDBOL0014', 'SEEDMASTER0014', 10200, 520, 'CTN', 1, 'Brass faucets 龙头及阀类', '3400', 'https://www.importyeti.com/shipment/seed-ship-f-014', 'importyeti_free_web', '2026-02-05T08:00:00.000Z'),
  -- Shower shipments from supplier-2
  ('seed-ship-s-001', 'seed-cn-supplier-2', 'seed-us-importer-1', 'AquaPro Trading Co.', '2026-07-09', 'import_declaration_date', 'SEEDBOL0015', 'SEEDMASTER0015', 9200, 480, 'CTN', 1, 'Plastic shower heads 塑料浴缸及淋浴盆', '3100', 'https://www.importyeti.com/shipment/seed-ship-s-001', 'importyeti_free_web', '2026-07-10T08:00:00.000Z'),
  ('seed-ship-s-002', 'seed-cn-supplier-2', 'seed-us-importer-1', 'AquaPro Trading Co.', '2026-06-15', 'import_declaration_date', 'SEEDBOL0016', 'SEEDMASTER0016', 8100, 420, 'CTN', 1, 'Plastic shower trays 塑料浴缸及淋浴盆', '2700', 'https://www.importyeti.com/shipment/seed-ship-s-002', 'importyeti_free_web', '2026-06-16T08:00:00.000Z'),
  ('seed-ship-s-003', 'seed-cn-supplier-2', 'seed-us-importer-1', 'AquaPro Trading Co.', '2026-05-27', 'import_declaration_date', 'SEEDBOL0017', 'SEEDMASTER0017', 10400, 540, 'CTN', 1, 'Plastic shower heads 塑料浴缸及淋浴盆', '3500', 'https://www.importyeti.com/shipment/seed-ship-s-003', 'importyeti_free_web', '2026-05-28T08:00:00.000Z');

INSERT OR IGNORE INTO shipment_collection_coverage
  (id, source_channel, entity_id, entity_role, product_key, hs_code, month, status, observed_shipments, pages_completed, first_observed_at, updated_at)
VALUES
  ('seed-cov-f-2026-07', 'importyeti_free_web', 'seed-us-importer-1', 'importer', '龙头及阀类', '848180', '2026-07', 'complete', 3, 1, '2026-07-01T08:00:00.000Z', '2026-07-15T08:00:00.000Z'),
  ('seed-cov-f-2026-06', 'importyeti_free_web', 'seed-us-importer-1', 'importer', '龙头及阀类', '848180', '2026-06', 'complete', 3, 1, '2026-06-01T08:00:00.000Z', '2026-06-19T08:00:00.000Z'),
  ('seed-cov-f-2026-05', 'importyeti_free_web', 'seed-us-importer-1', 'importer', '龙头及阀类', '848180', '2026-05', 'complete', 2, 1, '2026-05-01T08:00:00.000Z', '2026-05-22T08:00:00.000Z'),
  ('seed-cov-f-2026-04', 'importyeti_free_web', 'seed-us-importer-1', 'importer', '龙头及阀类', '848180', '2026-04', 'complete', 2, 1, '2026-04-01T08:00:00.000Z', '2026-04-17T08:00:00.000Z'),
  ('seed-cov-f-2026-03', 'importyeti_free_web', 'seed-us-importer-1', 'importer', '龙头及阀类', '848180', '2026-03', 'complete', 2, 1, '2026-03-01T08:00:00.000Z', '2026-03-20T08:00:00.000Z'),
  ('seed-cov-f-2026-02', 'importyeti_free_web', 'seed-us-importer-1', 'importer', '龙头及阀类', '848180', '2026-02', 'complete', 2, 1, '2026-02-01T08:00:00.000Z', '2026-02-18T08:00:00.000Z'),
  ('seed-cov-s-2026-07', 'importyeti_free_web', 'seed-us-importer-1', 'importer', '塑料浴缸及淋浴盆', '392210', '2026-07', 'complete', 1, 1, '2026-07-01T08:00:00.000Z', '2026-07-10T08:00:00.000Z'),
  ('seed-cov-s-2026-06', 'importyeti_free_web', 'seed-us-importer-1', 'importer', '塑料浴缸及淋浴盆', '392210', '2026-06', 'complete', 1, 1, '2026-06-01T08:00:00.000Z', '2026-06-16T08:00:00.000Z'),
  ('seed-cov-s-2026-05', 'importyeti_free_web', 'seed-us-importer-1', 'importer', '塑料浴缸及淋浴盆', '392210', '2026-05', 'complete', 1, 1, '2026-05-01T08:00:00.000Z', '2026-05-28T08:00:00.000Z');

INSERT OR IGNORE INTO buyer_monthly_rankings
  (id, market, product_category, year, month, buyer_id, rank, metric, metric_value, source, created_at)
VALUES
  ('seed-rank-faucet-2026-05', 'US', 'faucet', 2026, 5, 'seed-us-importer-1', 1, 'shipment_count', 2, 'importyeti_free_web', '2026-05-31T08:00:00.000Z'),
  ('seed-rank-faucet-2026-06', 'US', 'faucet', 2026, 6, 'seed-us-importer-1', 1, 'shipment_count', 3, 'importyeti_free_web', '2026-06-30T08:00:00.000Z'),
  ('seed-rank-shower-2026-06', 'US', 'shower', 2026, 6, 'seed-us-importer-1', 1, 'shipment_count', 1, 'importyeti_free_web', '2026-06-30T08:00:00.000Z');
