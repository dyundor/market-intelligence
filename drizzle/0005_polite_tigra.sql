CREATE TABLE `buyer_watchlist` (
	`id` text PRIMARY KEY NOT NULL,
	`company_id` text NOT NULL,
	`status` text DEFAULT 'new' NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `buyer_watchlist_company_idx` ON `buyer_watchlist` (`company_id`);--> statement-breakpoint
CREATE INDEX `buyer_watchlist_status_idx` ON `buyer_watchlist` (`status`);--> statement-breakpoint
CREATE UNIQUE INDEX `buyer_watchlist_company_uq` ON `buyer_watchlist` (`company_id`);