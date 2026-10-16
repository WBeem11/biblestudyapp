CREATE TABLE `books` (
	`id` integer PRIMARY KEY NOT NULL,
	`osis` text NOT NULL,
	`name` text NOT NULL,
	`testament` text NOT NULL,
	`genre` text NOT NULL,
	`chapters` integer NOT NULL,
	CONSTRAINT "books_testament" CHECK("books"."testament" IN ('OT','NT'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `books_osis_unique` ON `books` (`osis`);--> statement-breakpoint
CREATE TABLE `chapter_edges` (
	`from_chapter_ord` integer NOT NULL,
	`to_chapter_ord` integer NOT NULL,
	`ref_count` integer NOT NULL,
	`weight` integer NOT NULL,
	PRIMARY KEY(`from_chapter_ord`, `to_chapter_ord`)
);
--> statement-breakpoint
CREATE TABLE `chapters` (
	`ordinal` integer PRIMARY KEY NOT NULL,
	`book_id` integer NOT NULL,
	`chapter` integer NOT NULL,
	`verse_count` integer NOT NULL,
	FOREIGN KEY (`book_id`) REFERENCES `books`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `chapters_book_chapter` ON `chapters` (`book_id`,`chapter`);--> statement-breakpoint
CREATE TABLE `cross_refs` (
	`id` integer PRIMARY KEY NOT NULL,
	`from_verse` integer NOT NULL,
	`to_verse_start` integer NOT NULL,
	`to_verse_end` integer NOT NULL,
	`votes` integer DEFAULT 0 NOT NULL,
	`source` text DEFAULT 'openbible' NOT NULL,
	FOREIGN KEY (`from_verse`) REFERENCES `verses`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`to_verse_start`) REFERENCES `verses`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`to_verse_end`) REFERENCES `verses`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_xref_from` ON `cross_refs` (`from_verse`);--> statement-breakpoint
CREATE INDEX `idx_xref_to` ON `cross_refs` (`to_verse_start`);--> statement-breakpoint
CREATE TABLE `lemmas` (
	`strongs` text PRIMARY KEY NOT NULL,
	`language` text NOT NULL,
	`lemma` text NOT NULL,
	`translit` text,
	`gloss` text,
	`definition` text,
	`morph` text,
	`occurrences` integer DEFAULT 0 NOT NULL,
	CONSTRAINT "lemmas_language" CHECK("lemmas"."language" IN ('hbo','arc','grc'))
);
--> statement-breakpoint
CREATE TABLE `morph_codes` (
	`code` text PRIMARY KEY NOT NULL,
	`description` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `translations` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`license` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `verse_texts` (
	`verse_id` integer NOT NULL,
	`translation_id` text NOT NULL,
	`text` text NOT NULL,
	PRIMARY KEY(`verse_id`, `translation_id`),
	FOREIGN KEY (`verse_id`) REFERENCES `verses`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`translation_id`) REFERENCES `translations`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `verses` (
	`id` integer PRIMARY KEY NOT NULL,
	`book_id` integer NOT NULL,
	`chapter` integer NOT NULL,
	`verse` integer NOT NULL,
	`ordinal` integer NOT NULL,
	FOREIGN KEY (`book_id`) REFERENCES `books`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `verses_ordinal_unique` ON `verses` (`ordinal`);--> statement-breakpoint
CREATE UNIQUE INDEX `verses_book_chapter_verse` ON `verses` (`book_id`,`chapter`,`verse`);--> statement-breakpoint
CREATE TABLE `words` (
	`id` integer PRIMARY KEY NOT NULL,
	`verse_id` integer NOT NULL,
	`position` integer NOT NULL,
	`surface` text NOT NULL,
	`translit` text,
	`language` text NOT NULL,
	`strongs` text,
	`strongs_all` text,
	`morph` text,
	`gloss` text,
	`edition` text NOT NULL,
	`is_base` integer DEFAULT 1 NOT NULL,
	FOREIGN KEY (`verse_id`) REFERENCES `verses`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`strongs`) REFERENCES `lemmas`(`strongs`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_words_strongs` ON `words` (`strongs`,`is_base`);--> statement-breakpoint
CREATE UNIQUE INDEX `words_verse_position` ON `words` (`verse_id`,`position`);