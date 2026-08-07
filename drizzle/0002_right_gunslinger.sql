CREATE TABLE `importyeti_web_entities` (
	`id` text PRIMARY KEY NOT NULL,
	`entity_type` text NOT NULL,
	`name` text NOT NULL,
	`address` text,
	`country` text,
	`website` text,
	`total_shipments` integer,
	`latest_shipment_date` text,
	`avg_teu_per_shipment` text,
	`avg_teu_per_month` text,
	`estimated_shipping_spend_usd` integer,
	`shipping_spend_coverage_percent` integer,
	`contact_data_status` text DEFAULT 'not_available' NOT NULL,
	`source_url` text NOT NULL,
	`source_channel` text DEFAULT 'importyeti_free_web' NOT NULL,
	`source_attribution` text DEFAULT 'ImportYeti / U.S. Customs and Border Protection' NOT NULL,
	`search_query` text,
	`captured_at` text NOT NULL,
	`raw_evidence` text
);
--> statement-breakpoint
CREATE INDEX `importyeti_web_entities_type_name_idx` ON `importyeti_web_entities` (`entity_type`,`name`);--> statement-breakpoint
CREATE INDEX `importyeti_web_entities_query_idx` ON `importyeti_web_entities` (`search_query`);--> statement-breakpoint
CREATE TABLE `importyeti_web_relationships` (
	`id` text PRIMARY KEY NOT NULL,
	`supplier_id` text NOT NULL,
	`importer_id` text NOT NULL,
	`shipment_count` integer,
	`period_start` text,
	`period_end` text,
	`hs_codes` text,
	`product_descriptions` text,
	`source_url` text NOT NULL,
	`source_channel` text DEFAULT 'importyeti_free_web' NOT NULL,
	`captured_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `importyeti_web_relationships_supplier_idx` ON `importyeti_web_relationships` (`supplier_id`);--> statement-breakpoint
CREATE INDEX `importyeti_web_relationships_importer_idx` ON `importyeti_web_relationships` (`importer_id`);