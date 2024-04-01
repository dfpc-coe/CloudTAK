ALTER TABLE "profile" ADD COLUMN "display_stale" text DEFAULT '10 Minutes' NOT NULL;--> statement-breakpoint
ALTER TABLE "profile" ADD COLUMN "display_distance" text DEFAULT 'mile' NOT NULL;--> statement-breakpoint
ALTER TABLE "profile" ADD COLUMN "display_elevation" text DEFAULT 'mp/h' NOT NULL;