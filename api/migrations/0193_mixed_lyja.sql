ALTER TABLE "core_event" ADD COLUMN "links" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "core_event" ADD COLUMN "style" jsonb DEFAULT '{}'::jsonb NOT NULL;