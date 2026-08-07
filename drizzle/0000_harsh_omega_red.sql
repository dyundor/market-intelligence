CREATE TABLE `paid_api_cache` (
	`cache_key` text PRIMARY KEY NOT NULL,
	`provider` text NOT NULL,
	`state` text DEFAULT 'ready' NOT NULL,
	`payload` text,
	`fetched_at` integer,
	`expires_at` integer DEFAULT 0 NOT NULL,
	`stale_until` integer DEFAULT 0 NOT NULL,
	`lease_token` text,
	`lease_until` integer DEFAULT 0 NOT NULL,
	`last_error` text
);
