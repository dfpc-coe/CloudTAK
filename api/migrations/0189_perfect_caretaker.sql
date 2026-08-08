DROP TABLE IF EXISTS "core_incident" CASCADE;--> statement-breakpoint
ALTER TABLE "core_event" ADD COLUMN IF NOT EXISTS "active" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "core_event" ADD COLUMN IF NOT EXISTS "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL;
