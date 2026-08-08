CREATE TABLE `lead_outreach_drafts` (
	`id` text PRIMARY KEY NOT NULL,
	`company_id` text NOT NULL,
	`channel` text DEFAULT 'email' NOT NULL,
	`subject` text NOT NULL,
	`body` text NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`evidence_summary` text NOT NULL,
	`personalization_notes` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `lead_outreach_drafts_company_idx` ON `lead_outreach_drafts` (`company_id`);--> statement-breakpoint
CREATE INDEX `lead_outreach_drafts_status_idx` ON `lead_outreach_drafts` (`status`);