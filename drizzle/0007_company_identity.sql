-- Canonical company identity and correction history.
-- importyeti_web_entities.id is the immutable internal company_id.

ALTER TABLE `importyeti_web_entities` ADD `source_entity_key` text;
ALTER TABLE `importyeti_web_entities` ADD `identity_status` text DEFAULT 'source_verified' NOT NULL;
ALTER TABLE `importyeti_web_entities` ADD `first_seen_at` text;
ALTER TABLE `importyeti_web_entities` ADD `updated_at` text;
ALTER TABLE `importyeti_web_entities` ADD `record_version` integer DEFAULT 1 NOT NULL;

UPDATE `importyeti_web_entities`
SET `source_entity_key` = `source_channel` || ':' || `entity_type` || ':' ||
  CASE
    WHEN instr(`source_url`, '/company/') > 0 THEN substr(`source_url`, instr(`source_url`, '/company/') + 9)
    WHEN instr(`source_url`, '/supplier/') > 0 THEN substr(`source_url`, instr(`source_url`, '/supplier/') + 10)
    ELSE `id`
  END,
  `first_seen_at` = `captured_at`,
  `updated_at` = `captured_at`
WHERE `source_entity_key` IS NULL;

CREATE UNIQUE INDEX `importyeti_web_entities_source_key_uq`
ON `importyeti_web_entities` (`source_entity_key`)
WHERE `source_entity_key` IS NOT NULL;

CREATE TABLE `company_identity_aliases` (
  `id` text PRIMARY KEY NOT NULL,
  `company_id` text NOT NULL,
  `alias_type` text NOT NULL,
  `alias_value` text NOT NULL,
  `normalized_value` text NOT NULL,
  `source_channel` text NOT NULL,
  `source_url` text,
  `confidence` integer DEFAULT 100 NOT NULL,
  `first_seen_at` text NOT NULL,
  `last_seen_at` text NOT NULL,
  FOREIGN KEY (`company_id`) REFERENCES `importyeti_web_entities`(`id`) ON UPDATE no action ON DELETE cascade
);

CREATE UNIQUE INDEX `company_identity_aliases_company_value_uq`
ON `company_identity_aliases` (`company_id`, `alias_type`, `normalized_value`);
CREATE INDEX `company_identity_aliases_lookup_idx`
ON `company_identity_aliases` (`alias_type`, `normalized_value`);

INSERT OR IGNORE INTO `company_identity_aliases`
(`id`,`company_id`,`alias_type`,`alias_value`,`normalized_value`,`source_channel`,`source_url`,`confidence`,`first_seen_at`,`last_seen_at`)
SELECT 'alias:name:' || `id`, `id`, 'official_name', `name`, lower(trim(`name`)), `source_channel`, `source_url`, 100, `captured_at`, `captured_at`
FROM `importyeti_web_entities`;

INSERT OR IGNORE INTO `company_identity_aliases`
(`id`,`company_id`,`alias_type`,`alias_value`,`normalized_value`,`source_channel`,`source_url`,`confidence`,`first_seen_at`,`last_seen_at`)
SELECT 'alias:source:' || `id`, `id`, 'source_key', `source_entity_key`, lower(trim(`source_entity_key`)), `source_channel`, `source_url`, 100, `captured_at`, `captured_at`
FROM `importyeti_web_entities` WHERE `source_entity_key` IS NOT NULL;

CREATE TABLE `company_change_log` (
  `id` text PRIMARY KEY NOT NULL,
  `company_id` text NOT NULL,
  `change_type` text DEFAULT 'profile_update' NOT NULL,
  `old_snapshot` text,
  `new_snapshot` text,
  `source_channel` text NOT NULL,
  `source_url` text,
  `changed_at` text NOT NULL,
  FOREIGN KEY (`company_id`) REFERENCES `importyeti_web_entities`(`id`) ON UPDATE no action ON DELETE cascade
);

CREATE INDEX `company_change_log_company_date_idx`
ON `company_change_log` (`company_id`, `changed_at`);

-- Remove five legacy duplicates whose canonical iy:<house_bol> rows contain
-- the same or more complete evidence. New uniqueness prevents recurrence.
DELETE FROM `importyeti_web_shipments`
WHERE `house_bol` IS NOT NULL AND `house_bol` <> ''
  AND `id` NOT IN (
    SELECT CASE
      WHEN max(CASE WHEN substr(`id`,1,3)='iy:' THEN 1 ELSE 0 END)=1
        THEN max(CASE WHEN substr(`id`,1,3)='iy:' THEN `id` END)
      ELSE max(`id`)
    END
    FROM `importyeti_web_shipments`
    WHERE `house_bol` IS NOT NULL AND `house_bol` <> ''
    GROUP BY `source_channel`, `house_bol`
  );

CREATE UNIQUE INDEX `importyeti_web_shipments_source_house_bol_uq`
ON `importyeti_web_shipments` (`source_channel`, `house_bol`)
WHERE `house_bol` IS NOT NULL AND `house_bol` <> '';
