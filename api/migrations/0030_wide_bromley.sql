ALTER TABLE "profile" ALTER COLUMN "display_elevation" SET DEFAULT 'feet';--> statement-breakpoint
ALTER TABLE "profile" ADD COLUMN "display_speed" text DEFAULT 'mi/h' NOT NULL;