CREATE TABLE `lead_contact_research` (
	`id` text PRIMARY KEY NOT NULL,
	`company_name` text NOT NULL,
	`normalized_company_name` text NOT NULL,
	`company_id` text,
	`status` text DEFAULT 'unresolved' NOT NULL,
	`reason_code` text NOT NULL,
	`reason` text NOT NULL,
	`next_action` text NOT NULL,
	`evidence_urls` text DEFAULT '[]' NOT NULL,
	`researched_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `lead_contact_research_name_uq` ON `lead_contact_research` (`normalized_company_name`);--> statement-breakpoint
CREATE INDEX `lead_contact_research_status_idx` ON `lead_contact_research` (`status`,`updated_at`);--> statement-breakpoint
CREATE INDEX `lead_contact_research_company_idx` ON `lead_contact_research` (`company_id`);
