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
CREATE INDEX `api_usage_requests_provider_status_idx` ON `api_usage_requests` (`provider`,`status`);
--> statement-breakpoint
CREATE INDEX `api_usage_requests_query_hash_idx` ON `api_usage_requests` (`query_hash`);
--> statement-breakpoint
CREATE UNIQUE INDEX `api_usage_requests_active_query_uq` ON `api_usage_requests` (`provider`,`query_hash`) WHERE `status` IN ('awaiting_approval', 'approved', 'executing', 'reapproval_required');
--> statement-breakpoint
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
CREATE INDEX `api_usage_log_request_date_idx` ON `api_usage_log` (`request_id`,`created_at`);
--> statement-breakpoint
CREATE INDEX `api_usage_log_provider_date_idx` ON `api_usage_log` (`provider`,`created_at`);
--> statement-breakpoint
CREATE INDEX `api_usage_log_query_hash_idx` ON `api_usage_log` (`query_hash`);
