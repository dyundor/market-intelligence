CREATE TABLE `importyeti_web_shipments` (
	`id` text PRIMARY KEY NOT NULL,
	`supplier_id` text NOT NULL,
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
CREATE INDEX `importyeti_web_shipments_month_idx` ON `importyeti_web_shipments` (`shipment_date`);
CREATE INDEX `importyeti_web_shipments_supplier_idx` ON `importyeti_web_shipments` (`supplier_id`);
