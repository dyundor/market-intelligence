-- Durable evidence coverage and resumable collection queue.

CREATE TABLE `shipment_collection_coverage` (
  `id` text PRIMARY KEY NOT NULL,
  `source_channel` text NOT NULL,
  `entity_id` text NOT NULL,
  `entity_role` text NOT NULL,
  `product_key` text NOT NULL,
  `hs_code` text,
  `month` text NOT NULL,
  `status` text DEFAULT 'uncollected' NOT NULL,
  `observed_shipments` integer DEFAULT 0 NOT NULL,
  `pages_completed` integer DEFAULT 0 NOT NULL,
  `last_cursor` text,
  `classification_basis` text,
  `source_url` text,
  `first_observed_at` text,
  `last_attempt_at` text,
  `completed_at` text,
  `last_error` text,
  `updated_at` text NOT NULL,
  FOREIGN KEY (`entity_id`) REFERENCES `importyeti_web_entities`(`id`) ON UPDATE no action ON DELETE cascade
);

CREATE UNIQUE INDEX `shipment_collection_coverage_scope_uq`
ON `shipment_collection_coverage` (`source_channel`,`entity_id`,`product_key`,`month`);
CREATE INDEX `shipment_collection_coverage_product_month_idx`
ON `shipment_collection_coverage` (`product_key`,`month`,`status`);

CREATE TABLE `shipment_collection_jobs` (
  `id` text PRIMARY KEY NOT NULL,
  `source_channel` text NOT NULL,
  `entity_id` text NOT NULL,
  `entity_role` text NOT NULL,
  `product_key` text NOT NULL,
  `hs_code` text,
  `date_from` text NOT NULL,
  `date_to` text NOT NULL,
  `status` text DEFAULT 'queued' NOT NULL,
  `priority` integer DEFAULT 100 NOT NULL,
  `cursor` text,
  `pages_completed` integer DEFAULT 0 NOT NULL,
  `shipments_collected` integer DEFAULT 0 NOT NULL,
  `target_shipments` integer,
  `attempt_count` integer DEFAULT 0 NOT NULL,
  `last_error` text,
  `created_at` text NOT NULL,
  `updated_at` text NOT NULL,
  `completed_at` text,
  FOREIGN KEY (`entity_id`) REFERENCES `importyeti_web_entities`(`id`) ON UPDATE no action ON DELETE cascade
);

CREATE UNIQUE INDEX `shipment_collection_jobs_scope_uq`
ON `shipment_collection_jobs` (`source_channel`,`entity_id`,`product_key`,`date_from`,`date_to`);
CREATE INDEX `shipment_collection_jobs_queue_idx`
ON `shipment_collection_jobs` (`status`,`priority`,`updated_at`);

-- Existing rows prove that records were observed, but the source pagination
-- was not exhausted. They are therefore partial, never complete.
WITH product_map(product_key,hs_pattern) AS (
  VALUES ('龙头及阀类','8481.80'),('龙头阀门零件','8481.90'),('塑料浴缸及淋浴盆','3922.10'),
         ('瓷制陶瓷洁具','6910.10'),('其他陶瓷洁具','6910.90'),('钢铁卫浴制品','7324.90'),('铜制卫浴制品','7418.20')
), eligible AS (
  SELECT DISTINCT r.supplier_id entity_id,p.product_key,replace(p.hs_pattern,'.','') hs_code
  FROM importyeti_web_relationships r JOIN product_map p ON r.hs_codes LIKE '%'||p.hs_pattern||'%'
), observed AS (
  SELECT e.entity_id,e.product_key,e.hs_code,substr(s.shipment_date,1,7) month,count(*) observed_shipments,
         min(s.captured_at) first_observed_at,max(s.captured_at) updated_at
  FROM eligible e JOIN importyeti_web_shipments s ON s.supplier_id=e.entity_id
  GROUP BY e.entity_id,e.product_key,e.hs_code,substr(s.shipment_date,1,7)
)
INSERT INTO shipment_collection_coverage
(`id`,`source_channel`,`entity_id`,`entity_role`,`product_key`,`hs_code`,`month`,`status`,`observed_shipments`,`pages_completed`,`classification_basis`,`source_url`,`first_observed_at`,`last_attempt_at`,`updated_at`)
SELECT 'coverage:importyeti:'||o.entity_id||':'||o.product_key||':'||o.month,
       'importyeti_free_web',o.entity_id,'supplier',o.product_key,o.hs_code,o.month,'partial',o.observed_shipments,1,
       'supplier_relationship_hs',e.source_url,o.first_observed_at,o.updated_at,o.updated_at
FROM observed o JOIN importyeti_web_entities e ON e.id=o.entity_id;

-- Seed resumable jobs for every currently evidenced faucet/valve buyer and
-- supplier. A queued job is not evidence that the period has been collected.
WITH relevant(entity_id,entity_role,product_key,hs_code) AS (
  SELECT DISTINCT supplier_id,'supplier','龙头及阀类','848180' FROM importyeti_web_relationships
  WHERE hs_codes LIKE '%8481.80%' OR product_descriptions LIKE '%faucet%'
  UNION
  SELECT DISTINCT importer_id,'importer','龙头及阀类','848180' FROM importyeti_web_relationships
  WHERE hs_codes LIKE '%8481.80%' OR product_descriptions LIKE '%faucet%'
)
INSERT INTO shipment_collection_jobs
(`id`,`source_channel`,`entity_id`,`entity_role`,`product_key`,`hs_code`,`date_from`,`date_to`,`status`,`priority`,`target_shipments`,`created_at`,`updated_at`)
SELECT 'job:importyeti:'||r.entity_id||':848180:2024-01:2026-07','importyeti_free_web',r.entity_id,r.entity_role,r.product_key,r.hs_code,
       '2024-01','2026-07','queued',CASE WHEN r.entity_role='importer' THEN 50 ELSE 100 END,e.total_shipments,'2026-08-05','2026-08-05'
FROM relevant r JOIN importyeti_web_entities e ON e.id=r.entity_id;
