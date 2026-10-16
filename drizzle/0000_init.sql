CREATE TABLE `audit_log` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` text,
	`action` text NOT NULL,
	`payload` text,
	`at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE `invites` (
	`code` text PRIMARY KEY NOT NULL,
	`created_by` text NOT NULL,
	`expires_at` integer NOT NULL,
	`used_by` text,
	`used_at` integer,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`used_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE `movies` (
	`tmdb_id` integer PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`year` integer,
	`overview` text,
	`poster_path` text,
	`backdrop_path` text,
	`runtime` integer,
	`genres` text,
	`tmdb_rating` integer,
	`trailer_key` text,
	`radarr_status` text,
	`radarr_progress` integer,
	`seerr_status` text,
	`metadata_refreshed_at` integer,
	`status_refreshed_at` integer
);
--> statement-breakpoint
CREATE TABLE `nights` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`scheduled_for` integer,
	`status` text DEFAULT 'draft' NOT NULL,
	`nominate_until` integer,
	`vote_until` integer,
	`max_nominations` integer DEFAULT 2 NOT NULL,
	`max_votes` integer DEFAULT 3 NOT NULL,
	`self_vote_allowed` integer DEFAULT false NOT NULL,
	`results_hidden` integer DEFAULT true NOT NULL,
	`winner_tmdb_id` integer,
	`tiebreak_seed` text,
	`created_by` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`winner_tmdb_id`) REFERENCES `movies`(`tmdb_id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `nominations` (
	`id` text PRIMARY KEY NOT NULL,
	`night_id` text NOT NULL,
	`tmdb_id` integer NOT NULL,
	`user_id` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`night_id`) REFERENCES `nights`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`tmdb_id`) REFERENCES `movies`(`tmdb_id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `nominations_night_movie_uq` ON `nominations` (`night_id`,`tmdb_id`);--> statement-breakpoint
CREATE TABLE `ratings` (
	`night_id` text NOT NULL,
	`user_id` text NOT NULL,
	`score` integer NOT NULL,
	`comment` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	PRIMARY KEY(`night_id`, `user_id`),
	FOREIGN KEY (`night_id`) REFERENCES `nights`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`expires_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `sessions_user_idx` ON `sessions` (`user_id`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`auth_kind` text NOT NULL,
	`seerr_user_id` integer,
	`username` text NOT NULL,
	`password_hash` text,
	`display_name` text NOT NULL,
	`avatar_url` text,
	`role` text DEFAULT 'member' NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_seerr_user_id_unique` ON `users` (`seerr_user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `users_username_unique` ON `users` (`username`);--> statement-breakpoint
CREATE TABLE `votes` (
	`night_id` text NOT NULL,
	`user_id` text NOT NULL,
	`nomination_id` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	PRIMARY KEY(`night_id`, `user_id`, `nomination_id`),
	FOREIGN KEY (`night_id`) REFERENCES `nights`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`nomination_id`) REFERENCES `nominations`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `watchlist` (
	`user_id` text NOT NULL,
	`tmdb_id` integer NOT NULL,
	`note` text,
	`added_at` integer DEFAULT (unixepoch()) NOT NULL,
	PRIMARY KEY(`user_id`, `tmdb_id`),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`tmdb_id`) REFERENCES `movies`(`tmdb_id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `watchlist_tmdb_idx` ON `watchlist` (`tmdb_id`);