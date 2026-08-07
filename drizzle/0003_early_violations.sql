CREATE TABLE `api_usage_log` (
	`id` text PRIMARY KEY NOT NULL,
	`request_id` text NOT NULL,
	`provider` text NOT NULL,
	`query_hash` text NOT NULL,
	`event_type` text NOT NULL,
	`estimated_cost` text,
	`approved_cost` text,
	`actual_cost` text,
	`remaining_budget_before` text,
	`remaining_budget_after` text,
	`detail` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `api_usage_log_request_date_idx` ON `api_usage_log` (`request_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `api_usage_log_provider_date_idx` ON `api_usage_log` (`provider`,`created_at`);--> statement-breakpoint
CREATE INDEX `api_usage_log_query_hash_idx` ON `api_usage_log` (`query_hash`);--> statement-breakpoint
CREATE TABLE `api_usage_requests` (
	`id` text PRIMARY KEY NOT NULL,
	`provider` text NOT NULL,
	`endpoint` text NOT NULL,
	`query_hash` text NOT NULL,
	`query_description` text NOT NULL,
	`estimated_cost` text NOT NULL,
	`approved_cost` text,
	`actual_cost` text,
	`total_budget` text DEFAULT '100' NOT NULL,
	`reserve_budget` text DEFAULT '25' NOT NULL,
	`remaining_budget_before` text,
	`remaining_budget_after` text,
	`percent_of_total_budget` text,
	`percent_of_remaining_budget` text,
	`status` text DEFAULT 'awaiting_approval' NOT NULL,
	`failure_reason` text,
	`approved_at` text,
	`executed_at` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `api_usage_requests_provider_status_idx` ON `api_usage_requests` (`provider`,`status`);--> statement-breakpoint
CREATE INDEX `api_usage_requests_query_hash_idx` ON `api_usage_requests` (`query_hash`);--> statement-breakpoint
CREATE UNIQUE INDEX `api_usage_requests_active_query_uq` ON `api_usage_requests` (`provider`,`query_hash`) WHERE "api_usage_requests"."status" IN ('awaiting_approval', 'approved', 'executing', 'reapproval_required');--> statement-breakpoint
CREATE TABLE `buyer_monthly_rankings` (
	`id` text PRIMARY KEY NOT NULL,
	`market` text NOT NULL,
	`product_category` text NOT NULL,
	`year` integer NOT NULL,
	`month` integer NOT NULL,
	`buyer_id` text NOT NULL,
	`rank` integer NOT NULL,
	`metric` text NOT NULL,
	`metric_value` real NOT NULL,
	`source` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `buyer_monthly_rankings_scope_buyer_uq` ON `buyer_monthly_rankings` (`market`,`product_category`,`year`,`month`,`metric`,`buyer_id`);--> statement-breakpoint
CREATE INDEX `buyer_monthly_rankings_query_idx` ON `buyer_monthly_rankings` (`market`,`product_category`,`year`,`month`,`metric`,`rank`);--> statement-breakpoint
CREATE TABLE `buyer_supplier_relationships` (
	`id` text PRIMARY KEY NOT NULL,
	`buyer_id` text NOT NULL,
	`supplier_id` text NOT NULL,
	`product_category` text DEFAULT 'unknown' NOT NULL,
	`shipment_count` integer DEFAULT 0 NOT NULL,
	`first_seen` text,
	`last_seen` text,
	`source` text DEFAULT 'importyeti_free_web' NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `buyer_supplier_relationships_buyer_idx` ON `buyer_supplier_relationships` (`buyer_id`,`product_category`);--> statement-breakpoint
CREATE INDEX `buyer_supplier_relationships_supplier_idx` ON `buyer_supplier_relationships` (`supplier_id`);--> statement-breakpoint
CREATE TABLE `company_change_log` (
	`id` text PRIMARY KEY NOT NULL,
	`company_id` text NOT NULL,
	`change_type` text DEFAULT 'profile_update' NOT NULL,
	`old_snapshot` text,
	`new_snapshot` text,
	`source_channel` text NOT NULL,
	`source_url` text,
	`changed_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `company_change_log_company_date_idx` ON `company_change_log` (`company_id`,`changed_at`);--> statement-breakpoint
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
	`last_seen_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `company_identity_aliases_company_value_uq` ON `company_identity_aliases` (`company_id`,`alias_type`,`normalized_value`);--> statement-breakpoint
CREATE INDEX `company_identity_aliases_lookup_idx` ON `company_identity_aliases` (`alias_type`,`normalized_value`);--> statement-breakpoint
CREATE TABLE `importyeti_web_shipments` (
	`id` text PRIMARY KEY NOT NULL,
	`supplier_id` text NOT NULL,
	`importer_id` text,
	`importer_name` text NOT NULL,
	`shipment_date` text NOT NULL,
	`date_basis` text DEFAULT 'source_displayed_date_unspecified' NOT NULL,
	`export_declaration_date` text,
	`vessel_departure_date` text,
	`estimated_arrival_date` text,
	`actual_arrival_date` text,
	`import_declaration_date` text,
	`customs_release_date` text,
	`house_bol` text,
	`master_bol` text,
	`weight_kg` integer,
	`quantity` integer,
	`quantity_unit` text,
	`container_count` integer,
	`product_description` text,
	`estimated_freight_usd` text,
	`source_url` text NOT NULL,
	`source_channel` text DEFAULT 'importyeti_free_web' NOT NULL,
	`captured_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `importyeti_web_shipments_month_idx` ON `importyeti_web_shipments` (`shipment_date`);--> statement-breakpoint
CREATE INDEX `importyeti_web_shipments_supplier_idx` ON `importyeti_web_shipments` (`supplier_id`);--> statement-breakpoint
CREATE INDEX `importyeti_web_shipments_importer_idx` ON `importyeti_web_shipments` (`importer_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `importyeti_web_shipments_source_house_bol_uq` ON `importyeti_web_shipments` (`source_channel`,`house_bol`) WHERE "importyeti_web_shipments"."house_bol" is not null and "importyeti_web_shipments"."house_bol" <> '';--> statement-breakpoint
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
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `shipment_collection_coverage_scope_uq` ON `shipment_collection_coverage` (`source_channel`,`entity_id`,`product_key`,`month`);--> statement-breakpoint
CREATE INDEX `shipment_collection_coverage_product_month_idx` ON `shipment_collection_coverage` (`product_key`,`month`,`status`);--> statement-breakpoint
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
	`completed_at` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `shipment_collection_jobs_scope_uq` ON `shipment_collection_jobs` (`source_channel`,`entity_id`,`product_key`,`date_from`,`date_to`);--> statement-breakpoint
CREATE INDEX `shipment_collection_jobs_queue_idx` ON `shipment_collection_jobs` (`status`,`priority`,`updated_at`);--> statement-breakpoint
ALTER TABLE `importyeti_web_entities` ADD `country_code` text;--> statement-breakpoint
ALTER TABLE `importyeti_web_entities` ADD `admin1_code` text;--> statement-breakpoint
ALTER TABLE `importyeti_web_entities` ADD `admin1_name` text;--> statement-breakpoint
ALTER TABLE `importyeti_web_entities` ADD `city_name` text;--> statement-breakpoint
ALTER TABLE `importyeti_web_entities` ADD `location_names` text;--> statement-breakpoint
ALTER TABLE `importyeti_web_entities` ADD `location_precision` text DEFAULT 'country' NOT NULL;--> statement-breakpoint
ALTER TABLE `importyeti_web_entities` ADD `location_source` text;--> statement-breakpoint
ALTER TABLE `importyeti_web_entities` ADD `website_status` text DEFAULT 'unknown' NOT NULL;--> statement-breakpoint
ALTER TABLE `importyeti_web_entities` ADD `website_source_url` text;--> statement-breakpoint
ALTER TABLE `importyeti_web_entities` ADD `website_verified_at` text;--> statement-breakpoint
ALTER TABLE `importyeti_web_entities` ADD `chinese_name` text;--> statement-breakpoint
ALTER TABLE `importyeti_web_entities` ADD `marketplace_urls` text;--> statement-breakpoint
ALTER TABLE `importyeti_web_entities` ADD `source_entity_key` text;--> statement-breakpoint
ALTER TABLE `importyeti_web_entities` ADD `identity_status` text DEFAULT 'source_verified' NOT NULL;--> statement-breakpoint
ALTER TABLE `importyeti_web_entities` ADD `first_seen_at` text;--> statement-breakpoint
ALTER TABLE `importyeti_web_entities` ADD `updated_at` text;--> statement-breakpoint
ALTER TABLE `importyeti_web_entities` ADD `record_version` integer DEFAULT 1 NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `importyeti_web_entities_source_key_uq` ON `importyeti_web_entities` (`source_entity_key`);--> statement-breakpoint
ALTER TABLE `importyeti_web_relationships` ADD `discovery_direction` text DEFAULT 'supplier_profile' NOT NULL;--> statement-breakpoint
ALTER TABLE `importyeti_web_relationships` ADD `evidence_status` text DEFAULT 'verified' NOT NULL;