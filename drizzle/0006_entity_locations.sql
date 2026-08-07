ALTER TABLE `importyeti_web_entities` ADD `country_code` text;
ALTER TABLE `importyeti_web_entities` ADD `admin1_code` text;
ALTER TABLE `importyeti_web_entities` ADD `admin1_name` text;
ALTER TABLE `importyeti_web_entities` ADD `city_name` text;
ALTER TABLE `importyeti_web_entities` ADD `location_names` text;
ALTER TABLE `importyeti_web_entities` ADD `location_precision` text DEFAULT 'country' NOT NULL;
ALTER TABLE `importyeti_web_entities` ADD `location_source` text;
