ALTER TABLE "profile" ADD COLUMN "display_stale" text DEFAULT '10 Minutes' NOT NULL;--> statement-breakpoint
ALTER TABLE "profile" ADD COLUMN "display_distance" text DEFAULT 'mile' NOT NULL;--> statement-breakpoint
ALTER TABLE "profile" ADD COLUMN "display_elevation" text DEFAULT 'feet' NOT NULL;
ALTER TABLE "profile" ADD COLUMN "display_speed" text DEFAULT 'mi/h' NOT NULL;
