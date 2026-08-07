ALTER TABLE `importyeti_web_relationships` ADD COLUMN `discovery_direction` text DEFAULT 'supplier_profile' NOT NULL;
ALTER TABLE `importyeti_web_relationships` ADD COLUMN `evidence_status` text DEFAULT 'verified' NOT NULL;
ALTER TABLE `importyeti_web_shipments` ADD COLUMN `importer_id` text;
CREATE INDEX `importyeti_web_shipments_importer_idx` ON `importyeti_web_shipments` (`importer_id`);

UPDATE `importyeti_web_shipments`
SET `importer_id` = CASE
  WHEN lower(`importer_name`) LIKE 'arizona shower door%' THEN 'importer:arizona-shower-door'
  WHEN lower(`importer_name`) LIKE 'bath authority%' THEN 'importer:bath-authority'
  ELSE NULL
END
WHERE `importer_id` IS NULL;

UPDATE `importyeti_web_relationships`
SET `discovery_direction` = 'supplier_profile', `evidence_status` = 'verified';
