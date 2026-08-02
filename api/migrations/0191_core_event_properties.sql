ALTER TABLE "core_event" ADD COLUMN IF NOT EXISTS "mission_guid" uuid;--> statement-breakpoint
ALTER TABLE "core_event" ADD COLUMN IF NOT EXISTS "links" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "core_event" ADD COLUMN IF NOT EXISTS "style" jsonb DEFAULT '{}'::jsonb NOT NULL;
