CREATE TABLE `capture_promotions` (
	`id` text PRIMARY KEY NOT NULL,
	`manifest_path` text NOT NULL,
	`source_channel` text NOT NULL,
	`captured_at` text NOT NULL,
	`applied_at` text NOT NULL,
	`report_json` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `capture_promotions_source_date_idx` ON `capture_promotions` (`source_channel`,`captured_at`);
