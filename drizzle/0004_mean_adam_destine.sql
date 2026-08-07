CREATE TABLE `buyer_scores` (
	`id` text PRIMARY KEY NOT NULL,
	`score` real NOT NULL,
	`factors` text NOT NULL,
	`version` text NOT NULL,
	`computed_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `market_scores` (
	`id` text PRIMARY KEY NOT NULL,
	`score` real NOT NULL,
	`factors` text NOT NULL,
	`version` text NOT NULL,
	`computed_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `product_scores` (
	`id` text PRIMARY KEY NOT NULL,
	`score` real NOT NULL,
	`factors` text NOT NULL,
	`version` text NOT NULL,
	`computed_at` text NOT NULL
);
