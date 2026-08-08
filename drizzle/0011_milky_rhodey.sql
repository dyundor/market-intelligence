CREATE TABLE `lead_actions` (
	`id` text PRIMARY KEY NOT NULL,
	`company_id` text NOT NULL,
	`action_type` text NOT NULL,
	`direction` text DEFAULT 'outbound' NOT NULL,
	`channel` text,
	`summary` text NOT NULL,
	`outcome` text,
	`next_action` text,
	`next_action_due` text,
	`performed_by` text DEFAULT 'manual',
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `lead_actions_company_idx` ON `lead_actions` (`company_id`);--> statement-breakpoint
CREATE INDEX `lead_actions_type_idx` ON `lead_actions` (`action_type`);--> statement-breakpoint
CREATE TABLE `lead_contacts` (
	`id` text PRIMARY KEY NOT NULL,
	`company_id` text NOT NULL,
	`contact_type` text DEFAULT 'email' NOT NULL,
	`contact_value` text NOT NULL,
	`label` text,
	`source_url` text NOT NULL,
	`source_type` text DEFAULT 'manual' NOT NULL,
	`verified_at` text,
	`verification_status` text DEFAULT 'unverified' NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `lead_contacts_company_idx` ON `lead_contacts` (`company_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `lead_contacts_company_type_value_uq` ON `lead_contacts` (`company_id`,`contact_type`,`contact_value`);--> statement-breakpoint
ALTER TABLE `buyer_watchlist` ADD `lead_status` text DEFAULT 'new';--> statement-breakpoint
ALTER TABLE `buyer_watchlist` ADD `outreach_strategy` text;--> statement-breakpoint
ALTER TABLE `buyer_watchlist` ADD `recommended_products` text;--> statement-breakpoint
ALTER TABLE `buyer_watchlist` ADD `confidence` text;--> statement-breakpoint
ALTER TABLE `buyer_watchlist` ADD `commercial_fit_score` integer;--> statement-breakpoint
ALTER TABLE `buyer_watchlist` ADD `outreach_score` integer;