ALTER TABLE "video_lease" ADD COLUMN "source_type" text DEFAULT 'unknown' NOT NULL;--> statement-breakpoint
ALTER TABLE "video_lease" ADD COLUMN "source_model" text DEFAULT '' NOT NULL;--> statement-breakpoint
